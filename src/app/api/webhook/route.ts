// src/app/api/webhook/route.ts
// WooCommerce → Supabase order ingestion
// Configure in WooCommerce: Settings → Advanced → Webhooks
// Topic: Order created / Order updated
// Delivery URL: https://your-domain.com/api/webhook
// Secret: match WEBHOOK_SECRET env var

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.WEBHOOK_SECRET) return false
  const hmac = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64')
  return hmac === signature
}

// Extract a value from WooCommerce order meta
function extractMeta(meta_data: Array<{ key: string; value: unknown }>, key: string): string | null {
  const entry = meta_data?.find((m) => m.key === key)
  return entry ? String(entry.value) : null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-wc-webhook-signature')

  if (!verifySignature(rawBody, signature)) {
    console.warn('[webhook] Invalid signature')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    // ── Extract fields from WooCommerce payload ──────────────────────────────
    const order_ref    = String(payload.number ?? payload.id ?? '')
    const client_phone = extractMeta(payload.meta_data as [], '_billing_phone')
                         ?? (payload.billing as Record<string, string>)?.phone ?? null
    const product_id   = (payload.line_items as Array<{ product_id: number }>)?.[0]?.product_id?.toString() ?? null
    const vendor_id_raw = extractMeta(payload.meta_data as [], 'vendor_id')
    const vendor_name   = extractMeta(payload.meta_data as [], 'vendor_name') ?? null

    // Prix Client = payload.total (what the client actually paid)
    // per .MD spec: this is the ONLY pricing field that comes from WooCommerce
    const prix_client = parseFloat(String(payload.total ?? '0')) || 0

    // prix_fournisseur and benefice_merch default to 0
    // They will be filled in manually by the employee via the dashboard
    const prix_fournisseur = 0
    const benefice_merch   = 0

    if (!order_ref) {
      return NextResponse.json({ error: 'Missing order_ref' }, { status: 400 })
    }

    // ── Resolve vendor ─────────────────────────────────────────────────────────
    let vendor_id: string | null = null

    if (vendor_id_raw) {
      const { data: existingVendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('id', vendor_id_raw)
        .maybeSingle()

      if (existingVendor) {
        vendor_id = existingVendor.id
      } else if (vendor_name) {
        // Vendor ID sent but not found — auto-create per .MD spec
        const { data: newVendor, error: vendorErr } = await supabase
          .from('vendors')
          .insert({ id: vendor_id_raw, name: vendor_name })
          .select('id')
          .single()

        if (vendorErr) {
          console.error('[webhook] Failed to create vendor:', vendorErr)
        } else {
          vendor_id = newVendor.id
        }
      }
    }

    // ── Upsert order ───────────────────────────────────────────────────────────
    // Only set prix_client from webhook. Employee will fill in prix_fournisseur
    // and benefice_merch manually. DB computes prix_vendeur and benefice_vendeur.
    const { error: orderErr } = await supabase
      .from('orders')
      .upsert(
        {
          order_ref,
          client_phone,
          product_id,
          vendor_id,
          vendor_name,
          prix_client,
          prix_fournisseur,
          benefice_merch,
          status: 'EN_LIVRAISON',
        },
        { onConflict: 'order_ref', ignoreDuplicates: false }
      )

    if (orderErr) {
      console.error('[webhook] Order upsert failed:', orderErr)
      return NextResponse.json({ error: orderErr.message }, { status: 500 })
    }

    console.log(`[webhook] Order ${order_ref} upserted OK — prix_client: ${prix_client}`)
    return NextResponse.json({ ok: true, order_ref, prix_client })

  } catch (err) {
    console.error('[webhook] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// WooCommerce sends HEAD to verify endpoint
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
