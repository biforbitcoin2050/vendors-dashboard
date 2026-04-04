// src/app/(dashboard)/supplier-payments/SupplierPaymentsClient.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupplierPayment } from '@/lib/types'
import { fmt, fmtDate } from '@/lib/utils'
import { Plus, X, Truck } from 'lucide-react'

interface Props {
  payments: SupplierPayment[]
  unpaidOrders: { id: string; order_ref: string }[]
}

export default function SupplierPaymentsClient({ payments, unpaidOrders }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [local, setLocal] = useState<SupplierPayment[]>(payments)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [orderId, setOrderId] = useState('')

  const total = local.reduce((s, p) => s + p.amount, 0)

  async function handleCreate() {
    if (!amount || isNaN(parseFloat(amount))) { setError('Enter a valid amount'); return }
    setLoading(true); setError('')

    const { data, error: err } = await supabase
      .from('supplier_payments')
      .insert({
        amount: parseFloat(amount),
        note: note || null,
        order_id: orderId || null,
      })
      .select('*, orders(id, order_ref)')
      .single()

    setLoading(false)
    if (err) { setError(err.message); return }

    // If linked to an order, mark it as supplier paid
    if (orderId) {
      await supabase.from('orders').update({ is_supplier_paid: true }).eq('id', orderId)
    }

    setLocal(prev => [data as SupplierPayment, ...prev])
    setAmount(''); setNote(''); setOrderId('')
    setShowForm(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this payment?')) return
    setLocal(prev => prev.filter(p => p.id !== id))
    await supabase.from('supplier_payments').delete().eq('id', id)
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Supplier Payments</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
            {local.length} payment{local.length !== 1 ? 's' : ''} · Total: <strong style={{ color: 'var(--text-primary)' }}>{fmt(total)}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Payment</>}
        </button>
      </div>

      {/* Summary card */}
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
          <div className="kpi-label">Unpaid Orders (supplier)</div>
          <div className="kpi-value" style={{ fontSize: 22, color: unpaidOrders.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {unpaidOrders.length}
          </div>
        </div>
      </div>

      {/* Add payment form */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>New Supplier Payment</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: 140 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' }}>Amount (DA) *</label>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ flex: '2', minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' }}>Note</label>
              <input
                className="input"
                placeholder="Payment description…"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
            <div style={{ flex: '2', minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' }}>Link to Order (optional)</label>
              <select className="input" value={orderId} onChange={e => setOrderId(e.target.value)}>
                <option value="">— None —</option>
                {unpaidOrders.map(o => (
                  <option key={o.id} value={o.id}>#{o.order_ref}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? 'Saving…' : 'Add'}
              </button>
            </div>
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
