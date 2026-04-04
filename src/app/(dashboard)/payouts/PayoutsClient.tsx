// src/app/(dashboard)/payouts/PayoutsClient.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Payout, Vendor, Order } from '@/lib/types'
import { PayoutStatusBadge, OrderStatusBadge } from '@/components/StatusBadge'
import { fmt, fmtDate } from '@/lib/utils'
import { Plus, X, ChevronRight, Check } from 'lucide-react'

interface Props {
  payouts: Payout[]
  vendors: Vendor[]
  preselectedVendorId: string
}

export default function PayoutsClient({ payouts, vendors, preselectedVendorId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showCreate, setShowCreate] = useState(!!preselectedVendorId)
  const [localPayouts, setLocalPayouts] = useState<Payout[]>(payouts)

  // Create payout wizard state
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedVendorId, setSelectedVendorId] = useState(preselectedVendorId)
  const [eligibleOrders, setEligibleOrders] = useState<Order[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function loadEligibleOrders(vendorId: string) {
    setLoadingOrders(true)
    const { data } = await supabase
      .from('vendor_unpaid_orders')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
    setEligibleOrders((data ?? []) as Order[])
    // Select all by default
    setSelectedOrderIds(new Set((data ?? []).map((o: Order) => o.id)))
    setLoadingOrders(false)
  }

  function handleVendorSelect(vendorId: string) {
    setSelectedVendorId(vendorId)
    setStep(1)
    setEligibleOrders([])
    setSelectedOrderIds(new Set())
  }

  async function goToStep2() {
    if (!selectedVendorId) { setError('Select a vendor'); return }
    setError('')
    await loadEligibleOrders(selectedVendorId)
    setStep(2)
  }

  function toggleOrder(id: string) {
    setSelectedOrderIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedOrderIds.size === eligibleOrders.length) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(eligibleOrders.map(o => o.id)))
    }
  }

  // Calculated totals from selected orders
  const selected = eligibleOrders.filter(o => selectedOrderIds.has(o.id))
  const deliveredSelected = selected.filter(o => o.status === 'LIVREE')
  const retourSelected    = selected.filter(o => o.status === 'RETOUR')
  const totalBenefice = deliveredSelected.reduce((s, o) => s + (o.vendor_benefice ?? 0), 0)
  const retourLoss    = retourSelected.reduce((s, o) => s + (o.production_total ?? 0), 0)
  const netPayout     = totalBenefice - retourLoss

  async function createPayout() {
    if (selected.length === 0) { setError('Select at least one order'); return }
    setCreating(true); setError('')

    // 1. Insert payout
    const { data: payout, error: pe } = await supabase
      .from('payouts')
      .insert({
        vendor_id: selectedVendorId,
        total_orders: selected.length,
        total_vendor_benefice: totalBenefice,
        retour_loss: retourLoss,
        note: note || null,
        status: 'EN_ATTENTE',
      })
      .select('*, vendors(id, name)')
      .single()

    if (pe) { setError(pe.message); setCreating(false); return }

    // 2. Insert payout_orders relations
    const relations = selected.map(o => ({ payout_id: payout.id, order_id: o.id }))
    const { error: re } = await supabase.from('payout_orders').insert(relations)
    if (re) { setError(re.message); setCreating(false); return }

    // 3. Mark orders as vendor paid
    const { error: ue } = await supabase
      .from('orders')
      .update({ is_vendor_paid: true })
      .in('id', selected.map(o => o.id))
    if (ue) { setError(ue.message); setCreating(false); return }

    setCreating(false)
    setLocalPayouts(prev => [payout as Payout, ...prev])
    resetCreate()
    router.refresh()
  }

  function resetCreate() {
    setShowCreate(false); setStep(1)
    setSelectedVendorId(''); setEligibleOrders([])
    setSelectedOrderIds(new Set()); setNote(''); setError('')
  }

  async function togglePayoutStatus(id: string, current: string) {
    const next = current === 'EN_ATTENTE' ? 'SENT' : 'EN_ATTENTE'
    setLocalPayouts(prev => prev.map(p => p.id === id ? { ...p, status: next as Payout['status'] } : p))
    await supabase.from('payouts').update({ status: next }).eq('id', id)
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Payouts</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>{localPayouts.length} total payouts</p>
        </div>
        {!showCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Create Payout
          </button>
        )}
      </div>

      {/* Create Payout Wizard */}
      {showCreate && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StepIndicator n={1} active={step === 1} done={step > 1} label="Select Vendor" />
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              <StepIndicator n={2} active={step === 2} done={false} label="Choose Orders" />
            </div>
            <button onClick={resetCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Vendor</label>
                <select
                  className="input"
                  style={{ maxWidth: 320 }}
                  value={selectedVendorId}
                  onChange={e => handleVendorSelect(e.target.value)}
                >
                  <option value="">— Select vendor —</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              {error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
              <div>
                <button className="btn btn-primary" onClick={goToStep2} disabled={!selectedVendorId || loadingOrders}>
                  {loadingOrders ? 'Loading orders…' : 'Next: Choose Orders →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                  {eligibleOrders.length} eligible unpaid order{eligibleOrders.length !== 1 ? 's' : ''} for {vendors.find(v => v.id === selectedVendorId)?.name}
                </p>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={toggleAll}>
                  {selectedOrderIds.size === eligibleOrders.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {eligibleOrders.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13.5, padding: '16px 0' }}>
                  No eligible orders. Orders must be LIVRÉE or RETOUR and not already assigned to a payout.
                </p>
              ) : (
                <div className="card" style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)' }}>
                      <tr>
                        <th style={{ width: 36 }}></th>
                        <th>Ref</th>
                        <th>Status</th>
                        <th>Prod. Cost</th>
                        <th>V. Benefice</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleOrders.map(o => (
                        <tr
                          key={o.id}
                          style={{ cursor: 'pointer', opacity: selectedOrderIds.has(o.id) ? 1 : 0.45 }}
                          onClick={() => toggleOrder(o.id)}
                        >
                          <td>
                            <div style={{
                              width: 18, height: 18, borderRadius: 4,
                              border: `2px solid ${selectedOrderIds.has(o.id) ? 'var(--accent)' : 'var(--bg-border)'}`,
                              background: selectedOrderIds.has(o.id) ? 'var(--accent)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {selectedOrderIds.has(o.id) && <Check size={11} color="white" />}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5 }}>#{o.order_ref}</td>
                          <td><OrderStatusBadge status={o.status} /></td>
                          <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5 }}>{fmt(o.production_total)}</td>
                          <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--success)' }}>{fmt(o.vendor_benefice)}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{fmtDate(o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals summary */}
              {selected.length > 0 && (
                <div style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                  borderRadius: 10, padding: '14px 18px',
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
                }}>
                  <SummaryItem label="Orders Selected" value={String(selected.length)} />
                  <SummaryItem label="Benefice (LIVRÉE)" value={fmt(totalBenefice)} color="var(--success)" />
                  <SummaryItem label="Retour Loss" value={retourLoss > 0 ? `−${fmt(retourLoss)}` : '—'} color={retourLoss > 0 ? 'var(--danger)' : undefined} />
                  <SummaryItem label="Net Payout" value={fmt(netPayout)} color={netPayout >= 0 ? 'var(--success)' : 'var(--danger)'} bold />
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <input className="input" placeholder="Note (optional)…" value={note} onChange={e => setNote(e.target.value)} />
                </div>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary" onClick={createPayout} disabled={creating || selected.length === 0}>
                  {creating ? 'Creating…' : `Create Payout (${fmt(netPayout)})`}
                </button>
              </div>

              {error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
            </div>
          )}
        </div>
      )}

      {/* Payouts Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Date</th>
              <th>Orders</th>
              <th>Benefice</th>
              <th>Retour Loss</th>
              <th>Net Payout</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {localPayouts.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>No payouts yet</td></tr>
            )}
            {localPayouts.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.vendors?.name ?? '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{fmtDate(p.date)}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.total_orders}</td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5 }}>{fmt(p.total_vendor_benefice)}</td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: p.retour_loss > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {p.retour_loss > 0 ? `−${fmt(p.retour_loss)}` : '—'}
                </td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                  {fmt(p.net_payout)}
                </td>
                <td>
                  <button
                    onClick={() => togglePayoutStatus(p.id, p.status)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title="Click to toggle status"
                  >
                    <PayoutStatusBadge status={p.status} />
                  </button>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12.5, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.note ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StepIndicator({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--bg-border)',
        color: active || done ? 'white' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600,
      }}>
        {done ? <Check size={13} /> : n}
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  )
}

function SummaryItem({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: bold ? 700 : 500, color: color ?? 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{value}</div>
    </div>
  )
}
