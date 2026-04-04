// src/components/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, ShoppingBag, Users, CreditCard,
  Truck, LogOut, ChevronRight
} from 'lucide-react'

const NAV = [
  { href: '/',                 label: 'Overview',          icon: LayoutDashboard },
  { href: '/orders',           label: 'Orders',            icon: ShoppingBag },
  { href: '/vendors',          label: 'Vendors',           icon: Users },
  { href: '/payouts',          label: 'Payouts',           icon: CreditCard },
  { href: '/supplier-payments',label: 'Supplier Payments', icon: Truck },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--bg-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px',
    }}>
      {/* Brand */}
      <div style={{ padding: '4px 8px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
          }}>V</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>Vendors</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dashboard</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 7,
              fontSize: 13.5, fontWeight: active ? 500 : 400,
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: active ? 'var(--bg-elevated)' : 'transparent',
              textDecoration: 'none', transition: 'all 0.1s',
              border: active ? '1px solid var(--bg-border)' : '1px solid transparent',
            }}>
              <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
              {label}
              {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="btn btn-ghost"
        style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', fontSize: 13.5, gap: 10 }}
      >
        <LogOut size={15} />
        Sign Out
      </button>
    </aside>
  )
}
