// src/app/(dashboard)/vendors/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { VendorStats } from '@/lib/types'
import VendorsClient from './VendorsClient'

export const dynamic = 'force-dynamic'

export default async function VendorsPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('vendor_stats')
    .select('*')
    .order('net_vendor_profit', { ascending: false })

  return <VendorsClient stats={(data ?? []) as VendorStats[]} />
}
