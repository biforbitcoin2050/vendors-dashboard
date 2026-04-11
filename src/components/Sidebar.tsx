// src/components/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, ShoppingBag, Users, CreditCard,
  Truck, LogOut, ChevronRight, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'

const NAV = [
  { href: '/',                  label: 'Overview',          icon: LayoutDashboard },
  { href: '/orders',            label: 'Orders',            icon: ShoppingBag },
  { href: '/vendors',           label: 'Vendors',           icon: Users },
  { href: '/payouts',           label: 'Payouts',           icon: CreditCard },
  { href: '/supplier-payments', label: 'Supplier Payments', icon: Truck },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [collapsed, setCollapsed] = useState(false)

  // Persist collapse state across page navigations
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const width = collapsed ? 64 : 220

  return (
    <aside style={{
      width,
      flexShrink: 0,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--bg-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 8px',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
    }}>

      {/* Brand + collapse toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: '4px 4px 20px',
        minHeight: 48,
      }}>
        {!collapsed && (
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
        )}

        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'none',
            border: '1px solid var(--bg-border)',
            borderRadius: 7,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
        >
          {collapsed
            ? <PanelLeftOpen size={15} />
            : <PanelLeftClose size={15} />
          }
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: collapsed ? '9px 0' : '8px 10px',
                borderRadius: 7,
                fontSize: 13.5,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: active ? 'var(--bg-elevated)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.1s',
                border: active ? '1px solid var(--bg-border)' : '1px solid transparent',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
              {!collapsed && label}
              {!collapsed && active && (
                <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        title={collapsed ? 'Sign Out' : undefined}
        className="btn btn-ghost"
        style={{
          width: '100%',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '9px 0' : '8px 10px',
          fontSize: 13.5,
          gap: 10,
        }}
      >
        <LogOut size={15} />
        {!collapsed && 'Sign Out'}
      </button>
    </aside>
  )
}
