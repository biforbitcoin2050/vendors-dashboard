// src/app/(dashboard)/layout.tsx
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--bg-base)',
        padding: '32px 36px',
      }}>
        {children}
      </main>
    </div>
  )
}
