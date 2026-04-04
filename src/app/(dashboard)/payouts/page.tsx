// src/app/(dashboard)/payouts/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { Payout, Vendor } from '@/lib/types'
import PayoutsClient from './PayoutsClient'

export const dynamic = 'force-dynamic'

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Record<string, string>
}) {
  const supabase = createClient()
  const preselectedVendorId = searchParams.vendor ?? ''

  const [{ data: payouts }, { data: vendors }] = await Promise.all([
    supabase
      .from('payouts')
      .select('*, vendors(id, name)')
      .order('date', { ascending: false }),
    supabase.from('vendors').select('id, name').order('name'),
  ])

  return (
    <PayoutsClient
      payouts={(payouts ?? []) as Payout[]}
      vendors={(vendors ?? []) as Vendor[]}
      preselectedVendorId={preselectedVendorId}
    />
  )
}
