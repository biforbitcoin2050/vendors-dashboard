// src/lib/types.ts
// Database types matching the Supabase schema (per .MD spec)

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

  // Pricing fields (per .MD spec)
  prix_client: number         // From WooCommerce — what client paid
  prix_fournisseur: number    // Entered by employee — supplier cost
  benefice_merch: number      // Entered by employee — our margin
  prix_vendeur: number        // COMPUTED: prix_fournisseur + benefice_merch
  benefice_vendeur: number    // COMPUTED: prix_client - prix_vendeur

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
  total_vendor_benefice: number  // sum of benefice_vendeur for LIVREE orders
  retour_loss: number            // sum of prix_vendeur for RETOUR orders
  net_payout: number             // COMPUTED: total_vendor_benefice - retour_loss
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
  total_benefice: number        // SUM(benefice_vendeur) WHERE LIVREE
  total_retour_loss: number     // SUM(prix_vendeur) WHERE RETOUR
  net_vendor_profit: number     // total_benefice - total_retour_loss
  merch_total_profit: number    // SUM(benefice_merch) WHERE LIVREE
  total_revenue: number         // SUM(prix_client) WHERE LIVREE
}

export interface DashboardKPIs {
  total_orders: number
  total_delivered: number
  total_retour: number
  total_in_delivery: number
  total_merch_profit: number
  total_vendor_profit: number
  total_production_cost: number
  total_revenue: number
}
