// src/app/(dashboard)/vendors/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { Order, Payout, VendorStats } from '@/lib/types'
import { fmt, fmtDate } from '@/lib/utils'
import { OrderStatusBadge, PayoutStatusBadge } from '@/components/StatusBadge'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: vendor }, { data: stats }, { data: orders }, { data: payouts }] = await Promise.all([
    supabase.from('vendors').select('*').eq('id', params.id).single(),
    supabase.from('vendor_stats').select('*').eq('vendor_id', params.id).maybeSingle(),
    supabase.from('orders').select('*').eq('vendor_id', params.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('payouts').select('*').eq('vendor_id', params.id).order('date', { ascending: false }),
  ])

  if (!vendor) notFound()

  const s = stats as VendorStats | null
  const deliveryRate = s && s.total_orders > 0
    ? Math.round((s.delivered_orders / s.total_orders) * 100)
    : 0

  // Count orders needing prices
  const orderList = (orders as Order[]) ?? []
  const needsPrices = orderList.filter(o => o.prix_fournisseur === 0 && o.benefice_merch === 0).length

  return (
    <div style={{ maxWidth: 1100 }}>
      <Link href="/vendors" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Vendors
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>{vendor.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
            {vendor.phone ?? 'No phone'} · Added {fmtDate(vendor.created_at)}
          </p>
        </div>
        <Link href={`/payouts?vendor=${params.id}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Create Payout
        </Link>
      </div>

      {/* Stats */}
      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Orders', value: String(s.total_orders) },
            { label: 'Livrées', value: String(s.delivered_orders), color: 'var(--success)' },
            { label: 'Retours', value: String(s.retour_orders), color: s.retour_orders > 0 ? 'var(--danger)' : undefined },
            { label: 'Net Profit (Bénéfice Vendeur)', value: fmt(s.net_vendor_profit), color: s.net_vendor_profit >= 0 ? 'var(--success)' : 'var(--danger)' },
            { label: 'Revenu (Prix Client)', value: fmt(s.total_revenue ?? 0), color: 'var(--accent)' },
          ].map(item => (
            <div key={item.label} className="kpi-card">
              <div className="kpi-label">{item.label}</div>
              <div className="kpi-value" style={{ fontSize: 22, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Delivery rate bar */}
      {s && s.total_orders > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} style={{ color: 'var(--success)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Rate</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: deliveryRate >= 70 ? 'var(--success)' : deliveryRate >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
              {deliveryRate}%
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${deliveryRate}%`, background: deliveryRate >= 70 ? 'var(--success)' : deliveryRate >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
          {needsPrices > 0 && (
            <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 8 }}>
              ⚠ {needsPrices} order{needsPrices !== 1 ? 's' : ''} still need prix_fournisseur & bénéfice_merch
            </p>
          )}
        </div>
      )}

      {/* Orders */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Orders</h2>
          <a href={`/orders?vendor=${params.id}`} style={{ fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>
            Manage orders →
          </a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Status</th>
                <th>Prix Client</th>
                <th>Prix Fournisseur</th>
                <th>Bénéfice Merch</th>
                <th>Prix Vendeur</th>
                <th>Bénéfice Vendeur</th>
                <th>Vendor Paid</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orderList.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No orders</td></tr>
              )}
              {orderList.map(o => {
                const needsPrice = o.prix_fournisseur === 0 && o.benefice_merch === 0
                return (
                  <tr key={o.id} style={{ background: needsPrice ? 'rgba(245,158,11,0.04)' : undefined }}>
                    <td>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5 }}>#{o.order_ref}</span>
                      {needsPrice && <span style={{ display: 'block', fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>needs prices</span>}
                    </td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5 }}>{fmt(o.prix_client)}</td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {o.prix_fournisseur > 0 ? fmt(o.prix_fournisseur) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--accent)' }}>
                      {o.benefice_merch > 0 ? fmt(o.benefice_merch) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {o.prix_vendeur > 0 ? fmt(o.prix_vendeur) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, fontWeight: 600, color: o.benefice_vendeur > 0 ? 'var(--success)' : o.benefice_vendeur < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {o.prix_vendeur > 0 ? fmt(o.benefice_vendeur) : '—'}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, color: o.is_vendor_paid ? 'var(--success)' : 'var(--text-muted)' }}>
                        {o.is_vendor_paid ? '✓ Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{fmtDate(o.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payouts */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Payout History</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Orders</th>
                <th>Bénéfice Vendeur</th>
                <th>Retour Loss</th>
                <th>Net Payout</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {(payouts ?? []).length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No payouts yet</td></tr>
              )}
              {(payouts as Payout[]).map(p => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{fmtDate(p.date)}</td>
                  <td>{p.total_orders}</td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5 }}>{fmt(p.total_vendor_benefice)}</td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: p.retour_loss > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {p.retour_loss > 0 ? `−${fmt(p.retour_loss)}` : '—'}
                  </td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                    {fmt(p.net_payout)}
                  </td>
                  <td><PayoutStatusBadge status={p.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{p.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
