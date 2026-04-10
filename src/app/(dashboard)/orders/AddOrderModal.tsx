// src/app/(dashboard)/orders/AddOrderModal.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, Vendor, OrderStatus } from '@/lib/types'
import { X, Calculator } from 'lucide-react'

interface Props {
  vendors: Vendor[]
  onClose: () => void
  onCreated: (order: Order) => void
}

export default function AddOrderModal({ vendors, onClose, onCreated }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    order_ref: '',
    client_phone: '',
    product_id: '',
    vendor_id: '',
    prix_client: '',
    prix_fournisseur: '',
    benefice_merch: '',
    status: 'EN_LIVRAISON' as OrderStatus,
    note: '',
  })

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  // Computed preview values
  const prixVendeur = (parseFloat(form.prix_fournisseur) || 0) + (parseFloat(form.benefice_merch) || 0)
  const beneficeVendeur = (parseFloat(form.prix_client) || 0) - prixVendeur

  async function handleSubmit() {
    if (!form.order_ref) { setError('Order ref is required'); return }
    setLoading(true); setError('')

    const vendor = vendors.find(v => v.id === form.vendor_id)

    const { data, error: err } = await supabase
      .from('orders')
      .insert({
        order_ref:        form.order_ref.trim(),
        client_phone:     form.client_phone || null,
        product_id:       form.product_id || null,
        vendor_id:        form.vendor_id || null,
        vendor_name:      vendor?.name ?? null,
        prix_client:      parseFloat(form.prix_client) || 0,
        prix_fournisseur: parseFloat(form.prix_fournisseur) || 0,
        benefice_merch:   parseFloat(form.benefice_merch) || 0,
        status:           form.status,
        note:             form.note || null,
      })
      .select('*, vendors(id, name)')
      .single()

    setLoading(false)
    if (err) { setError(err.message); return }
    onCreated(data as Order)
  }

  return (
    <Modal title="Add Order" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Row>
          <Field label="Order Ref *">
            <input className="input" placeholder="e.g. 1042" value={form.order_ref} onChange={e => set('order_ref', e.target.value)} autoFocus />
          </Field>
          <Field label="Client Phone">
            <input className="input" placeholder="05XXXXXXXX" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} />
          </Field>
        </Row>
        <Row>
          <Field label="Vendor">
            <select className="input" value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}>
              <option value="">— None —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="EN_LIVRAISON">En Livraison</option>
              <option value="LIVREE">Livrée</option>
              <option value="RETOUR">Retour</option>
              <option value="ECHANGE">Échange</option>
            </select>
          </Field>
        </Row>

        {/* Pricing section */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Calculator size={13} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Pricing</span>
          </div>
          <Row>
            <Field label="Prix Client (DA) — from WooCommerce">
              <input className="input" type="number" min="0" placeholder="0" value={form.prix_client} onChange={e => set('prix_client', e.target.value)} />
            </Field>
          </Row>
          <div style={{ height: 10 }} />
          <Row>
            <Field label="Prix Fournisseur (DA)">
              <input className="input" type="number" min="0" placeholder="0" value={form.prix_fournisseur} onChange={e => set('prix_fournisseur', e.target.value)} />
            </Field>
            <Field label="Bénéfice Merch (DA)">
              <input className="input" type="number" min="0" placeholder="0" value={form.benefice_merch} onChange={e => set('benefice_merch', e.target.value)} />
            </Field>
          </Row>
          {/* Computed preview */}
          {(prixVendeur > 0 || beneficeVendeur !== 0) && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bg-border)' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prix Vendeur (computed)</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3 }}>
                  {prixVendeur.toLocaleString('fr-DZ')} DA
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bénéfice Vendeur (computed)</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: beneficeVendeur >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 3 }}>
                  {beneficeVendeur.toLocaleString('fr-DZ')} DA
                </div>
              </div>
            </div>
          )}
        </div>

        <Field label="Note">
          <input className="input" placeholder="Optional note…" value={form.note} onChange={e => set('note', e.target.value)} />
        </Field>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 6 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving…' : 'Create Order'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 12 }}>{children}</div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
        borderRadius: 14, width: '100%', maxWidth: 620,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  )
}
