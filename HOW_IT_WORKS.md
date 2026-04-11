# 🚀 How It Works — Vendors Dashboard

> **Merch By DZ** · Internal Admin Tool · For employees & developers

---

## 📌 The Big Picture

```
WooCommerce Store
      │
      │  Order placed by client
      │  → Webhook fires automatically
      ▼
Vendors Dashboard (this app)
      │
      │  Employee enters cost prices
      │  System computes profits
      ▼
Vendor gets paid via Payout
```

**Vendors Dashboard** is the financial back-office of Merch By DZ — a print-on-demand platform where independent vendors sell products and Merch handles printing + delivery.

---

## 👥 Who's Who

| Role | What they do |
|---|---|
| **Vendor** | Affiliate partner. Markets & sells products. Gets a commission per delivery. |
| **Merch By DZ** | Handles production (printing) + shipping. Keeps a margin on each sale. |
| **Supplier** | Makes the physical products. Gets paid by Merch. |
| **Client** | End customer who buys from the vendor's store. |
| **Employee** | Uses this dashboard to enter prices, track orders, and send payouts. |

---

## 💰 The Pricing Model (Core Concept)

Every order has **5 price fields**. Understanding these is everything.

```
┌──────────────────────────────────────────────────────┐
│                    ONE ORDER                         │
│                                                      │
│  prix_client       = 3 500 DA  ← From WooCommerce   │
│                                                      │
│  prix_fournisseur  =   800 DA  ← Employee fills in  │
│  benefice_merch    =   200 DA  ← Employee fills in  │
│  ─────────────────────────────                       │
│  prix_vendeur      = 1 000 DA  ← Auto-computed      │
│  benefice_vendeur  = 2 500 DA  ← Auto-computed      │
└──────────────────────────────────────────────────────┘
```

### Formulas

```
prix_vendeur    = prix_fournisseur + benefice_merch
benefice_vendeur = prix_client - prix_vendeur
```

### Who sees what?

| Field | Employee | Vendor |
|---|---|---|
| `prix_client` (what client paid) | ✅ Yes | ❌ No |
| `prix_fournisseur` (our cost) | ✅ Yes | ❌ No |
| `benefice_merch` (our margin) | ✅ Yes | ❌ No |
| `prix_vendeur` (vendor's price) | ✅ Yes | ✅ Yes |
| `benefice_vendeur` (vendor's profit) | ✅ Yes | ✅ Yes |

> **Key rule:** Vendors never see what Merch pays the supplier or our profit margin.

---

## 🔄 Order Lifecycle

### Step 1 — Client places an order on WooCommerce

A client buys a product on the vendor's WooCommerce store.

### Step 2 — Webhook fires automatically

WooCommerce sends a POST request to `/api/webhook` with the order data.

The system extracts:
- `order_ref` — the WooCommerce order number
- `prix_client` — `payload.total` (what the client paid)
- `client_phone` — billing phone
- `vendor_id` / `vendor_name` — from order meta
- `product_id` — the WooCommerce product ID

The order is inserted into the database with:
```
status = EN_LIVRAISON
prix_fournisseur = 0   (empty — employee must fill)
benefice_merch   = 0   (empty — employee must fill)
```

> If the vendor doesn't exist yet, they are **auto-created** in the vendors table.

### Step 3 — Employee enters prices

The order appears in the **Orders** page with an orange **"needs prices"** warning.

The employee clicks the **pencil icon** on the row and enters:
- `prix_fournisseur` — what Merch pays the supplier
- `benefice_merch` — Merch's profit margin

The database **instantly computes**:
- `prix_vendeur = prix_fournisseur + benefice_merch`
- `benefice_vendeur = prix_client - prix_vendeur`

### Step 4 — Delivery outcome

The employee updates the order status:

| Status | Meaning |
|---|---|
| `EN_LIVRAISON` | Currently in delivery (default) |
| `LIVREE` | Delivered ✅ — vendor earns `benefice_vendeur` |
| `RETOUR` | Returned ❌ — vendor loses `prix_vendeur` |
| `ECHANGE` | Exchanged — tracked separately |

### Step 5 — Vendor payout

When it's time to pay a vendor:

1. Go to **Payouts** → Create Payout
2. Select the vendor
3. See all eligible unpaid orders (LIVRÉE + RETOUR, not yet paid)
4. Select which orders to include (all selected by default)
5. The system calculates:

```
Net Payout = SUM(benefice_vendeur for LIVRÉE) − SUM(prix_vendeur for RETOUR)
```

6. Confirm → system creates the payout and marks all orders as `is_vendor_paid = true`
7. When money is sent, toggle the payout status from **En Attente → Sent**

---

## 📊 Dashboard Pages

### Overview `/`
Real-time KPIs:
- Total orders, delivered, retours, en livraison
- Total revenue (prix_client sum for LIVRÉE)
- Merch's total margin (benefice_merch sum for LIVRÉE)
- Top vendors ranked by net profit

### Orders `/orders`
The main daily workflow page for employees.

**Key actions:**
- 🔍 Search by order reference
- 🔽 Filter by status or vendor
- ✏️ Click pencil → enter `prix_fournisseur` + `benefice_merch`
- 🔄 Click status badge → change delivery status
- 🟢 Toggle switches → mark vendor paid / supplier paid
- ➕ Add Order button (or press `N`) → manual order creation

**Warning system:** Orders where `prix_fournisseur = 0` AND `benefice_merch = 0` are highlighted in orange with a "needs prices" tag.

### Vendors `/vendors`
- Lists all vendors with aggregated stats
- Delivery rate progress bar per vendor
- Click any row → vendor detail page
- Search vendors by name

### Vendor Detail `/vendors/[id]`
- Stats: total orders, livrées, retours, net profit, total revenue
- Delivery rate progress bar
- Full order history with pricing columns visible
- Full payout history
- "Create Payout" shortcut button

### Payouts `/payouts`
- 2-step wizard to create payouts
- Filter list by vendor or status
- Click status badge to toggle En Attente ↔ Sent
- Summary KPI cards: total en attente, total sent

### Supplier Payments `/supplier-payments`
- Tracks all payments made to the product supplier
- Optionally linked to a specific order
- Marks linked orders as `is_supplier_paid = true`

---

## 🗄️ Database Structure

### Tables
| Table | Purpose |
|---|---|
| `vendors` | Affiliate partner accounts |
| `orders` | One row per WooCommerce order |
| `payouts` | One row per vendor payout |
| `payout_orders` | Links payouts ↔ orders (many-to-many) |
| `supplier_payments` | Payments sent to the product supplier |

### Views (auto-computed)
| View | Purpose |
|---|---|
| `vendor_stats` | Per-vendor summary (orders, profits, revenue) |
| `vendor_unpaid_orders` | Orders eligible for a payout |
| `dashboard_kpis` | Aggregate totals for the overview page |

### Key constraint
An order can only be in **one payout**. Once linked via `payout_orders`, it disappears from the eligible orders list automatically (handled by the `vendor_unpaid_orders` view).

---

## 🔐 Authentication

- Single admin account via **Supabase Auth** (email + password)
- All dashboard pages are protected by `src/middleware.ts`
- Unauthenticated users → redirected to `/login`
- The webhook route `/api/webhook` is **excluded** from auth (uses HMAC signature instead)

---

## 🔗 Webhook Signature Validation

Every WooCommerce webhook is validated before processing:

```
Expected = HMAC-SHA256(raw_body, WEBHOOK_SECRET)
Received = x-wc-webhook-signature header
```

If they don't match → `401 Unauthorized`. Set `WEBHOOK_SECRET` in your `.env.local` to match the secret configured in WooCommerce.

---

## ⚙️ Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=       # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=      # Service role key (server-only, for webhook)
WEBHOOK_SECRET=                 # Must match WooCommerce webhook secret
```

---

## 🧱 Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar layout wrapper
│   │   ├── page.tsx                # Overview — KPIs + top vendors
│   │   ├── orders/
│   │   │   ├── page.tsx            # Server: fetch + filter
│   │   │   ├── OrdersClient.tsx    # Table + inline price edit
│   │   │   └── AddOrderModal.tsx   # Manual order form
│   │   ├── vendors/
│   │   │   ├── page.tsx
│   │   │   ├── VendorsClient.tsx   # Vendors table + search
│   │   │   └── [id]/page.tsx       # Vendor detail
│   │   ├── payouts/
│   │   │   ├── page.tsx
│   │   │   └── PayoutsClient.tsx   # 2-step payout wizard
│   │   └── supplier-payments/
│   │       ├── page.tsx
│   │       └── SupplierPaymentsClient.tsx
│   ├── api/webhook/route.ts        # WooCommerce webhook handler
│   ├── login/page.tsx
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Design system
├── components/
│   ├── Sidebar.tsx
│   └── StatusBadge.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   └── server.ts               # Server + service role clients
│   ├── types.ts                    # All TypeScript interfaces
│   └── utils.ts                    # fmt(), fmtDate() helpers
└── middleware.ts                   # Auth route protection
```

---

## 📋 Quick Reference — Pricing Cheat Sheet

```
CLIENT PAYS          → prix_client        (comes from WooCommerce)
MERCH PAYS SUPPLIER  → prix_fournisseur   (employee enters)
MERCH KEEPS          → benefice_merch     (employee enters)
VENDOR SELLS AT      → prix_vendeur       (auto = fournisseur + merch)
VENDOR EARNS         → benefice_vendeur   (auto = client - vendeur)
```

```
PAYOUT TO VENDOR =
  SUM(benefice_vendeur)  for all LIVRÉE orders
  − SUM(prix_vendeur)    for all RETOUR orders
```

---

*Merch By DZ — Internal Documentation — April 2026*
