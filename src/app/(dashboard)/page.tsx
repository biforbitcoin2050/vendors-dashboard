// src/app/(dashboard)/page.tsx
import { createClient } from '@/lib/supabase/server'
import { fmt } from '@/lib/utils'
import type { DashboardKPIs, VendorStats } from '@/lib/types'
import { ShoppingBag, TrendingUp, RotateCcw, Truck, DollarSign, BarChart2, Banknote } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OverviewPage() {
  const supabase = createClient()

  const [{ data: kpiRows }, { data: vendors }] = await Promise.all([
    supabase.from('dashboard_kpis').select('*'),
    supabase.from('vendor_stats').select('*').order('net_vendor_profit', { ascending: false }).limit(10),
  ])

  const kpi: DashboardKPIs = kpiRows?.[0] ?? {
    total_orders: 0, total_delivered: 0, total_retour: 0, total_in_delivery: 0,
    total_merch_profit: 0, total_vendor_profit: 0, total_production_cost: 0, total_revenue: 0,
  }

  const stats = (vendors ?? []) as VendorStats[]

  const deliveryRate = kpi.total_orders > 0
    ? Math.round((kpi.total_delivered / kpi.total_orders) * 100)
    : 0

  const retourRate = kpi.total_orders > 0
    ? Math.round((kpi.total_retour / kpi.total_orders) * 100)
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
          sub={`${kpi.total_in_delivery} en livraison`}
          color="var(--accent)"
        />
        <KPICard
          icon={<TrendingUp size={16} />}
          label="Livrées"
          value={String(kpi.total_delivered)}
          sub={`${deliveryRate}% delivery rate`}
          color="var(--success)"
          rate={deliveryRate}
        />
        <KPICard
          icon={<RotateCcw size={16} />}
          label="Retours"
          value={String(kpi.total_retour)}
          sub={`${retourRate}% retour rate`}
          color="var(--danger)"
        />
        <KPICard
          icon={<Truck size={16} />}
          label="En Livraison"
          value={String(kpi.total_in_delivery)}
          sub="status: EN_LIVRAISON"
          color="var(--info)"
        />
        <KPICard
          icon={<Banknote size={16} />}
          label="Total Revenu (Prix Client)"
          value={fmt(kpi.total_revenue ?? 0)}
          sub="from LIVRÉE orders"
          color="var(--accent)"
        />
        <KPICard
          icon={<DollarSign size={16} />}
          label="Bénéfice Merch"
          value={fmt(kpi.total_merch_profit)}
          sub="our margin (LIVRÉE)"
          color="var(--success)"
        />
      </div>

      {/* Top Vendors */}
      <div className="card">
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={15} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Top Vendors</h2>
          </div>
          <a href="/vendors" style={{ fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>View all →</a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Orders</th>
                <th>Livrées</th>
                <th>Retours</th>
                <th>Bénéfice Vendeur</th>
                <th>Retour Loss</th>
                <th>Net Profit</th>
                <th>Revenu (Prix Client)</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No data yet</td></tr>
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
                    {v.total_retour_loss > 0 ? `−${fmt(v.total_retour_loss)}` : '—'}
                  </td>
                  <td style={{
                    fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600,
                    color: v.net_vendor_profit >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {fmt(v.net_vendor_profit)}
                  </td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--accent)' }}>
                    {fmt(v.total_revenue ?? 0)}
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

function KPICard({ icon, label, value, sub, color, rate }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string; rate?: number
}) {
  return (
    <div className="kpi-card" style={{ borderTop: `2px solid ${color}` }}>
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
      {rate !== undefined && (
        <div style={{ marginTop: 10, height: 3, background: 'var(--bg-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
      )}
    </div>
  )
}
