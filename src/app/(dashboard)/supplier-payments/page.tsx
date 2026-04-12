// src/app/(dashboard)/supplier-payments/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { SupplierPayment } from '@/lib/types'
import SupplierPaymentsClient from './SupplierPaymentsClient'

export const dynamic = 'force-dynamic'

export default async function SupplierPaymentsPage() {
  const supabase = createClient()

  const [{ data: payments }, { data: orders }, { data: allUnpaid }] = await Promise.all([
    supabase
      .from('supplier_payments')
      .select('*, orders(id, order_ref)')
      .order('date', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_ref, vendor_name, prix_fournisseur, status')
      .eq('is_supplier_paid', false)
      .in('status', ['LIVREE', 'RETOUR'])           // LIVREE and RETOUR orders
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('orders')
      .select('prix_fournisseur')
      .eq('is_supplier_paid', false)
      .in('status', ['LIVREE', 'RETOUR'])
  ])

  const totalLeftToPay = allUnpaid?.reduce((sum, o) => sum + (o.prix_fournisseur || 0), 0) || 0

  return (
    <SupplierPaymentsClient
      payments={(payments ?? []) as SupplierPayment[]}
      unpaidOrders={(orders ?? []) as { id: string; order_ref: string; vendor_name: string | null; prix_fournisseur: number; status: string }[]}
      totalLeftToPay={totalLeftToPay}
    />
  )
}
