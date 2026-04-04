// src/app/(dashboard)/supplier-payments/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { SupplierPayment } from '@/lib/types'
import SupplierPaymentsClient from './SupplierPaymentsClient'

export const dynamic = 'force-dynamic'

export default async function SupplierPaymentsPage() {
  const supabase = createClient()

  const [{ data: payments }, { data: orders }] = await Promise.all([
    supabase
      .from('supplier_payments')
      .select('*, orders(id, order_ref)')
      .order('date', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_ref')
      .eq('is_supplier_paid', false)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  return (
    <SupplierPaymentsClient
      payments={(payments ?? []) as SupplierPayment[]}
      unpaidOrders={(orders ?? []) as { id: string; order_ref: string }[]}
    />
  )
}
