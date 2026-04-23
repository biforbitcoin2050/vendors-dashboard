// src/app/(dashboard)/orders/OrdersClient.tsx
'use client'
import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, Vendor, OrderStatus } from '@/lib/types'
import { OrderStatusBadge } from '@/components/StatusBadge'
import { fmt, fmtDate } from '@/lib/utils'
import { Plus, Search, X, ChevronDown, Pencil, Check, AlertTriangle, Save, Trash2, ScanLine, LayoutGrid, LayoutList, Archive } from 'lucide-react'
import AddOrderModal from './AddOrderModal'

const STATUSES: OrderStatus[] = ['EN_LIVRAISON', 'LIVREE', 'RETOUR', 'ECHANGE']

interface Props {
  orders: Order[]
  vendors: Vendor[]
  filters: { status: string; vendorId: string; search: string }
}

export default function OrdersClient({ orders, vendors, filters }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [localOrders, setLocalOrders] = useState<Order[]>(orders)

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrixFournisseur, setEditPrixFournisseur] = useState('')
  const [editBeneficeMerch, setEditBeneficeMerch] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState(filters.search)
  const [status, setStatus] = useState(filters.status)
  const [vendorId, setVendorId] = useState(filters.vendorId)

  // ── View mode: active vs archived ─────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active')

  // ── Scan / Multi-select mode ──────────────────────────────────────────────
  const [scanMode, setScanMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Keyboard shortcut: N = open Add Order
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey &&
          !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) {
        setShowAdd(true)
      }
      if (e.key === 'Escape') {
        setShowAdd(false)
        setEditingId(null)
        if (scanMode) { setScanMode(false); setSelectedIds(new Set()) }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [scanMode])

  function applyFilters(overrides?: Partial<typeof filters>) {
    const params = new URLSearchParams()
    const s = overrides?.search  ?? search
    const st = overrides?.status ?? status
    const v = overrides?.vendorId ?? vendorId
    if (s)  params.set('search', s)
    if (st) params.set('status', st)
    if (v)  params.set('vendor', v)
    startTransition(() => router.push(`/orders?${params.toString()}`))
  }

  function clearFilters() {
    setSearch(''); setStatus(''); setVendorId('')
    startTransition(() => router.push('/orders'))
  }

  const hasFilters = !!filters.search || !!filters.status || !!filters.vendorId

  // ── Split orders into active / archived ─────────────────────────────────
  const activeOrders = useMemo(() => localOrders.filter(o => !(o.is_vendor_paid && o.is_supplier_paid)), [localOrders])
  const archivedOrders = useMemo(() => localOrders.filter(o => o.is_vendor_paid && o.is_supplier_paid), [localOrders])

  const displayOrders = viewMode === 'active' ? activeOrders : archivedOrders

  // ── Instant client-side search filter ───────────────────────────────────
  const filteredOrders = useMemo(() => {
    if (!search.trim()) return displayOrders
    const q = search.trim().toLowerCase()
    return displayOrders.filter(o => o.order_ref.toLowerCase().includes(q))
  }, [displayOrders, search])

  // ── Counts ────────────────────────────────────────────────────────────────
  const needsPrices = filteredOrders.filter(o => o.prix_fournisseur === 0 && o.benefice_merch === 0).length

  // ── Scan mode selection helpers ───────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectedOrders = useMemo(() => filteredOrders.filter(o => selectedIds.has(o.id)), [filteredOrders, selectedIds])
  const selTotalPF = selectedOrders.reduce((s, o) => s + o.prix_fournisseur, 0)
  const selTotalBM = selectedOrders.reduce((s, o) => s + o.benefice_merch, 0)
  const selTotalBV = selectedOrders.reduce((s, o) => s + o.benefice_vendeur, 0)

  // ── Inline price edit ──────────────────────────────────────────────────────
  function startEdit(order: Order) {
    setEditingId(order.id)
    setEditPrixFournisseur(order.prix_fournisseur > 0 ? String(order.prix_fournisseur) : '')
    setEditBeneficeMerch(order.benefice_merch > 0 ? String(order.benefice_merch) : '')
  }

  async function saveEdit(order: Order) {
    setEditSaving(true)
    const pf = parseFloat(editPrixFournisseur) || 0
    const bm = parseFloat(editBeneficeMerch) || 0

    await supabase
      .from('orders')
      .update({ prix_fournisseur: pf, benefice_merch: bm })
      .eq('id', order.id)

    // Optimistic update
    setLocalOrders(prev => prev.map(o =>
      o.id === order.id
        ? { ...o, prix_fournisseur: pf, benefice_merch: bm, prix_vendeur: pf + bm, benefice_vendeur: o.prix_client - (pf + bm) }
        : o
    ))
    setEditingId(null)
    setEditSaving(false)
    router.refresh()
  }

  // ── Status update ──────────────────────────────────────────────────────────
  async function updateStatus(id: string, newStatus: OrderStatus) {
    setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
    await supabase.from('orders').update({ status: newStatus }).eq('id', id)
    router.refresh()
  }

  async function toggleBool(id: string, field: 'is_vendor_paid' | 'is_supplier_paid', current: boolean) {
    setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, [field]: !current } : o))
    const { error } = await supabase.from('orders').update({ [field]: !current }).eq('id', id)
    if (error) {
      // Rollback on error
      setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, [field]: current } : o))
    }
  }

  // ── Delete order ──────────────────────────────────────────────────────────
  async function deleteOrder(id: string) {
    if (!confirm('Delete this order? This action cannot be undone.')) return
    setLocalOrders(prev => prev.filter(o => o.id !== id))
    await supabase.from('orders').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Orders</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
            </p>
            {needsPrices > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(245,158,11,0.12)', color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600,
              }}>
                <AlertTriangle size={11} />
                {needsPrices} needs prices
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`btn ${scanMode ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setScanMode(v => !v); setSelectedIds(new Set()) }}
            title="Toggle scan mode"
          >
            <ScanLine size={15} />
            {scanMode ? 'Exit Scan' : 'Scan Mode'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Add Order
            <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 4, fontWeight: 400 }}>N</span>
          </button>
        </div>
      </div>

      {/* View Tabs: Active / Archived */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button
          onClick={() => setViewMode('active')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s', border: 'none',
            background: viewMode === 'active' ? 'var(--accent)' : 'var(--bg-elevated)',
            color: viewMode === 'active' ? 'white' : 'var(--text-secondary)',
          }}
        >
          <LayoutList size={14} />
          All Orders
          <span style={{
            background: viewMode === 'active' ? 'rgba(255,255,255,0.2)' : 'var(--bg-border)',
            padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          }}>{activeOrders.length}</span>
        </button>
        <button
          onClick={() => setViewMode('archived')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s', border: 'none',
            background: viewMode === 'archived' ? 'var(--accent)' : 'var(--bg-elevated)',
            color: viewMode === 'archived' ? 'white' : 'var(--text-secondary)',
          }}
        >
          <Archive size={14} />
          Archived
          <span style={{
            background: viewMode === 'archived' ? 'rgba(255,255,255,0.2)' : 'var(--bg-border)',
            padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          }}>{archivedOrders.length}</span>
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search by order ref…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <select
            className="input"
            style={{ paddingRight: 32, appearance: 'none', cursor: 'pointer', minWidth: 160 }}
            value={status}
            onChange={e => { setStatus(e.target.value); applyFilters({ status: e.target.value }) }}
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        <div style={{ position: 'relative' }}>
          <select
            className="input"
            style={{ paddingRight: 32, appearance: 'none', cursor: 'pointer', minWidth: 160 }}
            value={vendorId}
            onChange={e => { setVendorId(e.target.value); applyFilters({ vendorId: e.target.value }) }}
          >
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {hasFilters && (
          <button className="btn btn-ghost" onClick={clearFilters}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* ── Scan Mode: Totals Bar ─────────────────────────────────────────── */}
      {scanMode && selectedIds.size > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18,
        }}>
          <div className="kpi-card" style={{ borderTop: '2px solid var(--warning)', padding: '14px 18px' }}>
            <div className="kpi-label">P.F (Selected)</div>
            <div className="kpi-value" style={{ fontSize: 20, color: 'var(--warning)' }}>{fmt(selTotalPF)}</div>
            <div className="kpi-sub">{selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''}</div>
          </div>
          <div className="kpi-card" style={{ borderTop: '2px solid var(--accent)', padding: '14px 18px' }}>
            <div className="kpi-label">Bén. Merch (Selected)</div>
            <div className="kpi-value" style={{ fontSize: 20, color: 'var(--accent)' }}>{fmt(selTotalBM)}</div>
          </div>
          <div className="kpi-card" style={{ borderTop: '2px solid var(--success)', padding: '14px 18px' }}>
            <div className="kpi-label">Bén. Vendeur (Selected)</div>
            <div className="kpi-value" style={{ fontSize: 20, color: 'var(--success)' }}>{fmt(selTotalBV)}</div>
          </div>
        </div>
      )}

      {/* ── Scan Mode: Card Grid ──────────────────────────────────────────── */}
      {scanMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filteredOrders.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
              No orders found
            </div>
          )}
          {filteredOrders.map(order => {
            const isSelected = selectedIds.has(order.id)
            return (
              <div
                key={order.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--bg-border)'}`,
                  borderRadius: 12, padding: 16, cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? '0 0 0 3px var(--accent-glow)' : 'none',
                }}
                onClick={() => toggleSelect(order.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    #{order.order_ref}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  {order.vendors?.name ?? order.vendor_name ?? '—'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>P. Client: </span>
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>{fmt(order.prix_client)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>P.F: </span>
                    <span style={{ fontFamily: 'DM Mono, monospace', color: order.prix_fournisseur === 0 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                      {order.prix_fournisseur === 0 ? '—' : fmt(order.prix_fournisseur)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Bén. M: </span>
                    <span style={{ fontFamily: 'DM Mono, monospace', color: order.benefice_merch === 0 ? 'var(--text-muted)' : 'var(--accent)' }}>
                      {order.benefice_merch === 0 ? '—' : fmt(order.benefice_merch)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Bén. V: </span>
                    <span style={{
                      fontFamily: 'DM Mono, monospace', fontWeight: 600,
                      color: order.benefice_vendeur > 0 ? 'var(--success)' : order.benefice_vendeur < 0 ? 'var(--danger)' : 'var(--text-muted)',
                    }}>
                      {order.prix_vendeur === 0 ? '—' : fmt(order.benefice_vendeur)}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(order.created_at)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); toggleSelect(order.id) }}
                    style={{
                      padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                      background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: isSelected ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {isSelected ? '✓ Selected' : 'Select'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Normal Table View ──────────────────────────────────────────── */
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Ref</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Prix Client</th>
                <th>P.F</th>
                <th>Bén. Merch</th>
                <th>Prix Vendeur</th>
                <th>Bén. Vendeur</th>
                <th>Vendor Paid</th>
                <th>Supplier Paid</th>
                <th>Date</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                    No orders found
                  </td>
                </tr>
              )}
              {filteredOrders.map(order => {
                const needsPrice = order.prix_fournisseur === 0 && order.benefice_merch === 0
                const isEditing = editingId === order.id

                // Computed preview while editing
                const previewPrixVendeur = isEditing
                  ? (parseFloat(editPrixFournisseur) || 0) + (parseFloat(editBeneficeMerch) || 0)
                  : order.prix_vendeur
                const previewBeneficeVendeur = isEditing
                  ? order.prix_client - previewPrixVendeur
                  : order.benefice_vendeur

                return (
                  <tr key={order.id} style={{ background: needsPrice && !isEditing ? 'rgba(245,158,11,0.04)' : undefined }}>
                    <td>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                        #{order.order_ref}
                      </span>
                      {needsPrice && !isEditing && (
                        <span style={{ display: 'block', fontSize: 10, color: '#fbbf24', fontWeight: 600, marginTop: 2 }}>
                          needs prices
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {order.vendors?.name ?? order.vendor_name ?? '—'}
                    </td>
                    <td>
                      <StatusSelect
                        current={order.status}
                        onChange={s => updateStatus(order.id, s)}
                      />
                    </td>
                    {/* Prix Client — read only (from WooCommerce) */}
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--text-primary)' }}>
                      {fmt(order.prix_client)}
                    </td>
                    {/* Prix Fournisseur — editable */}
                    <td>
                      {isEditing ? (
                        <input
                          className="input"
                          type="number"
                          min="0"
                          style={{ width: 100, padding: '4px 8px', fontSize: 12.5 }}
                          value={editPrixFournisseur}
                          onChange={e => setEditPrixFournisseur(e.target.value)}
                          placeholder="0"
                          autoFocus
                        />
                      ) : (
                        <span style={{
                          fontFamily: 'DM Mono, monospace', fontSize: 12.5,
                          color: order.prix_fournisseur === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                        }}>
                          {order.prix_fournisseur === 0 ? '—' : fmt(order.prix_fournisseur)}
                        </span>
                      )}
                    </td>
                    {/* Bénéfice Merch — editable */}
                    <td>
                      {isEditing ? (
                        <input
                          className="input"
                          type="number"
                          min="0"
                          style={{ width: 100, padding: '4px 8px', fontSize: 12.5 }}
                          value={editBeneficeMerch}
                          onChange={e => setEditBeneficeMerch(e.target.value)}
                          placeholder="0"
                        />
                      ) : (
                        <span style={{
                          fontFamily: 'DM Mono, monospace', fontSize: 12.5,
                          color: order.benefice_merch === 0 ? 'var(--text-muted)' : 'var(--accent)',
                        }}>
                          {order.benefice_merch === 0 ? '—' : fmt(order.benefice_merch)}
                        </span>
                      )}
                    </td>
                    {/* Prix Vendeur — computed */}
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {previewPrixVendeur === 0 ? '—' : fmt(previewPrixVendeur)}
                    </td>
                    {/* Bénéfice Vendeur — computed */}
                    <td style={{
                      fontFamily: 'DM Mono, monospace', fontSize: 12.5, fontWeight: 600,
                      color: previewBeneficeVendeur > 0 ? 'var(--success)' : previewBeneficeVendeur < 0 ? 'var(--danger)' : 'var(--text-muted)',
                    }}>
                      {previewPrixVendeur === 0 ? '—' : fmt(previewBeneficeVendeur)}
                    </td>
                    <td>
                      <Toggle
                        checked={order.is_vendor_paid}
                        onChange={() => toggleBool(order.id, 'is_vendor_paid', order.is_vendor_paid)}
                        label="vendor"
                      />
                    </td>
                    <td>
                      <Toggle
                        checked={order.is_supplier_paid}
                        onChange={() => toggleBool(order.id, 'is_supplier_paid', order.is_supplier_paid)}
                        label="supplier"
                      />
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {fmtDate(order.created_at)}
                    </td>
                    {/* Actions: Edit / Save / Delete */}
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {isEditing ? (
                          <button
                            onClick={() => saveEdit(order)}
                            disabled={editSaving}
                            style={{ background: 'var(--success)', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4, color: 'white', fontSize: 12 }}
                            title="Save prices"
                          >
                            {editSaving ? '…' : <><Save size={12} /> Save</>}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(order)}
                              style={{ background: 'none', border: '1px solid var(--bg-border)', cursor: 'pointer', borderRadius: 6, padding: '5px 8px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                              title="Edit prix fournisseur & bénéfice merch"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteOrder(order.id)}
                              style={{ background: 'none', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', borderRadius: 6, padding: '5px 8px', display: 'flex', alignItems: 'center', color: '#f87171' }}
                              title="Delete order"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddOrderModal
          vendors={vendors}
          onClose={() => setShowAdd(false)}
          onCreated={order => {
            setLocalOrders(prev => [order, ...prev])
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusSelect({ current, onChange }: { current: OrderStatus; onChange: (s: OrderStatus) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <OrderStatusBadge status={current} />
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 20,
            background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
            borderRadius: 8, padding: 4, minWidth: 160, marginTop: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false) }}
                style={{
                  display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 8,
                  padding: '7px 10px', background: s === current ? 'var(--bg-hover)' : 'none',
                  border: 'none', cursor: 'pointer', borderRadius: 5,
                }}
              >
                <OrderStatusBadge status={s} />
                {s === current && <Check size={11} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      title={`Toggle ${label} paid`}
      style={{
        width: 38, height: 22, borderRadius: 11,
        background: checked ? 'var(--success)' : 'var(--bg-border)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 19 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: 'white', transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}
