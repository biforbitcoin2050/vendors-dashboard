// src/app/(dashboard)/orders/OrdersClient.tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, Vendor, OrderStatus } from '@/lib/types'
import { OrderStatusBadge } from '@/components/StatusBadge'
import { fmt, fmtDate } from '@/lib/utils'
import { Plus, Search, X, ChevronDown } from 'lucide-react'
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

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState(filters.search)
  const [status, setStatus] = useState(filters.status)
  const [vendorId, setVendorId] = useState(filters.vendorId)

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

  // ── Inline update helpers ─────────────────────────────────────────────────
  async function updateStatus(id: string, newStatus: OrderStatus) {
    setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
    await supabase.from('orders').update({ status: newStatus }).eq('id', id)
    router.refresh()
  }

  async function toggleBool(id: string, field: 'is_vendor_paid' | 'is_supplier_paid', current: boolean) {
    setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, [field]: !current } : o))
    await supabase.from('orders').update({ [field]: !current }).eq('id', id)
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Orders</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
            {localOrders.length} order{localOrders.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Add Order
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search order ref…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters({ search })}
          />
        </div>

        {/* Status filter */}
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

        {/* Vendor filter */}
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

        {/* Apply search */}
        <button className="btn btn-primary" onClick={() => applyFilters()}>Search</button>

        {hasFilters && (
          <button className="btn btn-ghost" onClick={clearFilters}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order Ref</th>
              <th>Vendor</th>
              <th>Client Phone</th>
              <th>Status</th>
              <th>Prod. Cost</th>
              <th>V. Benefice</th>
              <th>M. Benefice</th>
              <th>Vendor Paid</th>
              <th>Supplier Paid</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {localOrders.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                  No orders found
                </td>
              </tr>
            )}
            {localOrders.map(order => (
              <tr key={order.id}>
                <td>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                    #{order.order_ref}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {order.vendors?.name ?? order.vendor_name ?? '—'}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {order.client_phone ?? '—'}
                </td>
                <td>
                  <StatusSelect
                    current={order.status}
                    onChange={s => updateStatus(order.id, s)}
                  />
                </td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5 }}>
                  {fmt(order.production_total)}
                </td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--success)' }}>
                  {fmt(order.vendor_benefice)}
                </td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--accent)' }}>
                  {fmt(order.merch_benefice)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 10px', background: s === current ? 'var(--bg-hover)' : 'none',
                  border: 'none', cursor: 'pointer', borderRadius: 5,
                }}
              >
                <OrderStatusBadge status={s} />
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
