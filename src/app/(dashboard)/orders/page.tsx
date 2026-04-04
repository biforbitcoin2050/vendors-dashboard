// src/app/(dashboard)/orders/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { Order, Vendor } from '@/lib/types'
import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Record<string, string>
}) {
  const supabase = createClient()

  const status   = searchParams.status   ?? ''
  const vendorId = searchParams.vendor   ?? ''
  const search   = searchParams.search   ?? ''

  let query = supabase
    .from('orders')
    .select('*, vendors(id, name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status)   query = query.eq('status', status)
  if (vendorId) query = query.eq('vendor_id', vendorId)
  if (search)   query = query.ilike('order_ref', `%${search}%`)

  const [{ data: orders }, { data: vendors }] = await Promise.all([
    query,
    supabase.from('vendors').select('id, name').order('name'),
  ])

  return (
    <OrdersClient
      orders={(orders ?? []) as Order[]}
      vendors={(vendors ?? []) as Vendor[]}
      filters={{ status, vendorId, search }}
    />
  )
}
