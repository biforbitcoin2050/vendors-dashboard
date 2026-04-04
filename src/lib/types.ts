// src/lib/types.ts
// Database types matching the Supabase schema

export type OrderStatus = 'EN_LIVRAISON' | 'LIVREE' | 'RETOUR' | 'ECHANGE'
export type PayoutStatus = 'EN_ATTENTE' | 'SENT'

export interface Vendor {
  id: string
  name: string
  phone: string | null
  created_at: string
}

export interface Order {
  id: string
  order_ref: string
  client_phone: string | null
  product_id: string | null
  vendor_id: string | null
  vendor_name: string | null
  product_cost: number
  printing_cost: number
  production_total: number   // computed
  vendor_benefice: number
  merch_benefice: number
  status: OrderStatus
  note: string | null
  is_vendor_paid: boolean
  is_supplier_paid: boolean
  created_at: string
  // join
  vendors?: Vendor
}

export interface Payout {
  id: string
  vendor_id: string
  total_orders: number
  total_vendor_benefice: number
  retour_loss: number
  net_payout: number          // computed
  date: string
  status: PayoutStatus
  note: string | null
  // join
  vendors?: Vendor
}

export interface PayoutOrder {
  id: string
  payout_id: string
  order_id: string
}

export interface SupplierPayment {
  id: string
  amount: number
  note: string | null
  date: string
  order_id: string | null
  // join
  orders?: Order
}

export interface VendorStats {
  vendor_id: string
  vendor_name: string
  total_orders: number
  delivered_orders: number
  retour_orders: number
  total_benefice: number
  total_retour_loss: number
  net_vendor_profit: number
  merch_total_profit: number
}

export interface DashboardKPIs {
  total_orders: number
  total_delivered: number
  total_retour: number
  total_in_delivery: number
  total_merch_profit: number
  total_vendor_profit: number
  total_production_cost: number
}
