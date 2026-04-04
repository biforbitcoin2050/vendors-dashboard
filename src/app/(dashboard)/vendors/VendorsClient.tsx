// src/app/(dashboard)/vendors/VendorsClient.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { VendorStats } from '@/lib/types'
import { fmt } from '@/lib/utils'
import { Plus, X, Users } from 'lucide-react'

export default function VendorsClient({ stats }: { stats: VendorStats[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createVendor() {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.from('vendors').insert({ name: name.trim(), phone: phone || null })
    setLoading(false)
    if (err) { setError(err.message); return }
    setName(''); setPhone(''); setShowAdd(false)
    router.refresh()
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Vendors</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
            {stats.length} vendor{stats.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Add Vendor
        </button>
      </div>

      {/* Add vendor inline form */}
      {showAdd && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' }}>Vendor Name *</label>
              <input className="input" placeholder="e.g. Youcef Store" value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' }}>Phone</label>
              <input className="input" placeholder="05XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={createVendor} disabled={loading}>
              {loading ? 'Saving…' : 'Create'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setError('') }}>
              <X size={14} />
            </button>
          </div>
          {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Total Orders</th>
              <th>Delivered</th>
              <th>Retours</th>
              <th>Benefice (DA)</th>
              <th>Retour Loss (DA)</th>
              <th>Net Profit (DA)</th>
              <th>Merch Profit (DA)</th>
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
                    <Users size={32} strokeWidth={1.2} />
                    <span>No vendors yet. Create one above.</span>
                  </div>
                </td>
              </tr>
            )}
            {stats.map(v => (
              <tr
                key={v.vendor_id}
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/vendors/${v.vendor_id}`)}
              >
                <td>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v.vendor_name}</span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{v.total_orders}</td>
                <td>
                  <span style={{ color: 'var(--success)', fontWeight: 500 }}>{v.delivered_orders}</span>
                </td>
                <td>
                  <span style={{ color: v.retour_orders > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {v.retour_orders}
                  </span>
                </td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{fmt(v.total_benefice)}</td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: v.total_retour_loss > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {v.total_retour_loss > 0 ? `−${fmt(v.total_retour_loss)}` : '—'}
                </td>
                <td style={{
                  fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600,
                  color: v.net_vendor_profit >= 0 ? 'var(--success)' : 'var(--danger)'
                }}>
                  {fmt(v.net_vendor_profit)}
                </td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--accent)' }}>
                  {fmt(v.merch_total_profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
