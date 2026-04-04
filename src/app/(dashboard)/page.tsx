// src/app/(dashboard)/page.tsx
import { createClient } from '@/lib/supabase/server'
import { fmt } from '@/lib/utils'
import type { DashboardKPIs, VendorStats } from '@/lib/types'
import { ShoppingBag, TrendingUp, RotateCcw, Truck, DollarSign, Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OverviewPage() {
  const supabase = createClient()

  const [{ data: kpiRows }, { data: vendors }] = await Promise.all([
    supabase.from('dashboard_kpis').select('*'),
    supabase.from('vendor_stats').select('*').order('net_vendor_profit', { ascending: false }).limit(10),
  ])

  const kpi: DashboardKPIs = kpiRows?.[0] ?? {
    total_orders: 0, total_delivered: 0, total_retour: 0, total_in_delivery: 0,
    total_merch_profit: 0, total_vendor_profit: 0, total_production_cost: 0,
  }

  const stats = (vendors ?? []) as VendorStats[]

  const deliveryRate = kpi.total_orders > 0
    ? Math.round((kpi.total_delivered / kpi.total_orders) * 100)
    : 0

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Overview</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
          Real-time snapshot of your vendor affiliate operations.
        </p>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <KPICard
          icon={<ShoppingBag size={16} />}
          label="Total Orders"
          value={String(kpi.total_orders)}
          sub={`${deliveryRate}% delivery rate`}
          color="var(--accent)"
        />
        <KPICard
          icon={<TrendingUp size={16} />}
          label="Delivered"
          value={String(kpi.total_delivered)}
          sub="status: LIVRÉE"
          color="var(--success)"
        />
        <KPICard
          icon={<RotateCcw size={16} />}
          label="Retours"
          value={String(kpi.total_retour)}
          sub="status: RETOUR"
          color="var(--danger)"
        />
        <KPICard
          icon={<Truck size={16} />}
          label="In Delivery"
          value={String(kpi.total_in_delivery)}
          sub="status: EN LIVRAISON"
          color="var(--info)"
        />
        <KPICard
          icon={<DollarSign size={16} />}
          label="Merch Profit"
          value={fmt(kpi.total_merch_profit)}
          sub="from delivered orders"
          color="var(--success)"
        />
        <KPICard
          icon={<Package size={16} />}
          label="Production Cost"
          value={fmt(kpi.total_production_cost)}
          sub="product + printing"
          color="var(--warning)"
        />
      </div>

      {/* Top Vendors */}
      <div className="card">
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Top Vendors</h2>
          <a href="/vendors" style={{ fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>View all →</a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Orders</th>
                <th>Delivered</th>
                <th>Retours</th>
                <th>Benefice (DA)</th>
                <th>Retour Loss (DA)</th>
                <th>Net Profit (DA)</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No data yet</td></tr>
              )}
              {stats.map(v => (
                <tr key={v.vendor_id}>
                  <td>
                    <a href={`/vendors/${v.vendor_id}`} style={{ color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>
                      {v.vendor_name}
                    </a>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{v.total_orders}</td>
                  <td style={{ color: 'var(--success)' }}>{v.delivered_orders}</td>
                  <td style={{ color: v.retour_orders > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{v.retour_orders}</td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{fmt(v.total_benefice)}</td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: v.total_retour_loss > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {v.total_retour_loss > 0 ? `-${fmt(v.total_retour_loss)}` : '—'}
                  </td>
                  <td style={{
                    fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600,
                    color: v.net_vendor_profit >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {fmt(v.net_vendor_profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string
}) {
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>{icon}</div>
        <span className="kpi-label" style={{ marginBottom: 0 }}>{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  )
}
