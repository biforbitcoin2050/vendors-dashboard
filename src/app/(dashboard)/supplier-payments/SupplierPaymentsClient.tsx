// src/app/(dashboard)/supplier-payments/SupplierPaymentsClient.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupplierPayment } from '@/lib/types'
import { fmt, fmtDate } from '@/lib/utils'
import { Plus, X, Truck, Check } from 'lucide-react'

type UnpaidOrder = {
  id: string
  order_ref: string
  vendor_name: string | null
  prix_fournisseur: number
}

interface Props {
  payments: SupplierPayment[]
  unpaidOrders: UnpaidOrder[]
}

export default function SupplierPaymentsClient({ payments, unpaidOrders }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [local, setLocal] = useState<SupplierPayment[]>(payments)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')

  const total = local.reduce((s, p) => s + p.amount, 0)

  // Auto-compute amount from selected orders' prix_fournisseur
  const selectedOrders = unpaidOrders.filter(o => selectedIds.has(o.id))
  const autoAmount = selectedOrders.reduce((s, o) => s + (o.prix_fournisseur ?? 0), 0)

  function toggleOrder(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === unpaidOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unpaidOrders.map(o => o.id)))
    }
  }

  function resetForm() {
    setShowForm(false)
    setSelectedIds(new Set())
    setNote('')
    setError('')
  }

  async function handleCreate() {
    if (selectedIds.size === 0) { setError('Select at least one order'); return }
    setLoading(true); setError('')

    // Create one supplier payment record per selected order
    const rows = selectedOrders.map(o => ({
      amount: o.prix_fournisseur ?? 0,
      note: note || null,
      order_id: o.id,
    }))

    const { data, error: err } = await supabase
      .from('supplier_payments')
      .insert(rows)
      .select('*, orders(id, order_ref)')

    if (err) { setError(err.message); setLoading(false); return }

    // Mark all selected orders as supplier paid
    await supabase
      .from('orders')
      .update({ is_supplier_paid: true })
      .in('id', Array.from(selectedIds))

    setLocal(prev => [...(data as SupplierPayment[]), ...prev])
    setLoading(false)
    resetForm()
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this payment?')) return
    setLocal(prev => prev.filter(p => p.id !== id))
    await supabase.from('supplier_payments').delete().eq('id', id)
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Supplier Payments</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
            {local.length} payment{local.length !== 1 ? 's' : ''} · Total: <strong style={{ color: 'var(--text-primary)' }}>{fmt(total)}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => showForm ? resetForm() : setShowForm(true)}>
          {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Payment</>}
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Paid to Supplier</div>
          <div className="kpi-value" style={{ fontSize: 22 }}>{fmt(total)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Payments Count</div>
          <div className="kpi-value" style={{ fontSize: 22 }}>{local.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unpaid LIVRÉE Orders</div>
          <div className="kpi-value" style={{ fontSize: 22, color: unpaidOrders.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {unpaidOrders.length}
          </div>
        </div>
      </div>

      {/* Add payment form — multi-select */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>New Supplier Payment</h3>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={toggleAll}>
              {selectedIds.size === unpaidOrders.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {unpaidOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5, padding: '12px 0' }}>
              No unpaid LIVRÉE orders found.
            </p>
          ) : (
            <div style={{ border: '1px solid var(--bg-border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16, maxHeight: 340, overflowY: 'auto' }}>
              <table className="data-table">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)' }}>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Order Ref</th>
                    <th>Vendor</th>
                    <th>Prix Fournisseur</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidOrders.map(o => (
                    <tr
                      key={o.id}
                      style={{ cursor: 'pointer', opacity: selectedIds.has(o.id) ? 1 : 0.5 }}
                      onClick={() => toggleOrder(o.id)}
                    >
                      <td>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: `2px solid ${selectedIds.has(o.id) ? 'var(--accent)' : 'var(--bg-border)'}`,
                          background: selectedIds.has(o.id) ? 'var(--accent)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {selectedIds.has(o.id) && <Check size={11} color="white" />}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5 }}>#{o.order_ref}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{o.vendor_name ?? '—'}</td>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--accent)' }}>
                        {fmt(o.prix_fournisseur ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary + note + confirm */}
          {selectedIds.size > 0 && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 32 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Orders Selected</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedIds.size}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total to Pay Supplier</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)', fontFamily: 'DM Mono, monospace' }}>{fmt(autoAmount)}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Note (optional)…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={loading || selectedIds.size === 0}
            >
              {loading ? 'Saving…' : `Confirm Payment${selectedIds.size > 0 ? ` (${selectedIds.size} orders)` : ''}`}
            </button>
          </div>

          {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 10 }}>{error}</p>}
        </div>
      )}

      {/* Payments table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Note</th>
              <th>Linked Order</th>
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {local.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
                    <Truck size={32} strokeWidth={1.2} />
                    <span>No supplier payments recorded yet.</span>
                  </div>
                </td>
              </tr>
            )}
            {local.map(p => (
              <tr key={p.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtDate(p.date)}</td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>
                  {fmt(p.amount)}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{p.note ?? '—'}</td>
                <td>
                  {p.orders ? (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--accent)' }}>
                      #{p.orders.order_ref}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td>
                  <button
                    onClick={() => handleDelete(p.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
                    title="Delete payment"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
