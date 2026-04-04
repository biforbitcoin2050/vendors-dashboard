# Vendors Dashboard

Merch By DZ — Affiliate Vendor Management System  
**Stack:** Next.js 14 (App Router) · Supabase · Tailwind · Vercel

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/vendors-dashboard.git
cd vendors-dashboard
npm install
```

### 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
WEBHOOK_SECRET=your-woocommerce-webhook-secret
```

### 3. Supabase Setup

1. Go to **Supabase → SQL Editor**
2. Paste and run the full contents of `supabase_schema.sql`
3. Go to **Authentication → Users → Add user** → create your admin account

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Set all 4 env vars in the Vercel dashboard under **Settings → Environment Variables**.

---

## WooCommerce Webhook Setup

1. WooCommerce → Settings → Advanced → Webhooks → **Add webhook**
2. Configure:
   - **Name:** Vendors Dashboard Orders
   - **Status:** Active
   - **Topic:** Order created *(add a second for Order updated)*
   - **Delivery URL:** `https://your-vercel-domain.com/api/webhook`
   - **Secret:** same value as `WEBHOOK_SECRET`
3. The webhook maps these WooCommerce **order meta** keys:
   - `vendor_id` → vendor UUID
   - `vendor_name` → fallback name for auto-creation
   - `product_cost`, `printing_cost`
   - `vendor_benefice`, `merch_benefice`

If `vendor_id` doesn't exist in the DB, the vendor is auto-created using `vendor_name`.

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar wrapper
│   │   ├── page.tsx                # Overview / KPIs
│   │   ├── orders/
│   │   │   ├── page.tsx            # Server: fetch + filter
│   │   │   ├── OrdersClient.tsx    # Interactive table
│   │   │   └── AddOrderModal.tsx   # Create order form
│   │   ├── vendors/
│   │   │   ├── page.tsx
│   │   │   ├── VendorsClient.tsx
│   │   │   └── [id]/page.tsx       # Vendor detail
│   │   ├── payouts/
│   │   │   ├── page.tsx
│   │   │   └── PayoutsClient.tsx   # 2-step wizard
│   │   └── supplier-payments/
│   │       ├── page.tsx
│   │       └── SupplierPaymentsClient.tsx
│   ├── api/
│   │   └── webhook/route.ts        # WooCommerce ingestion
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── Sidebar.tsx
│   └── StatusBadge.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   └── server.ts               # Server + service role clients
│   ├── types.ts                    # All DB types
│   └── utils.ts                    # fmt(), fmtDate()
└── middleware.ts                   # Auth protection
```

---

## Business Logic Reference

### Payout Calculation (auto-computed in wizard)

```
net_payout = SUM(vendor_benefice WHERE status = 'LIVREE')
           - SUM(production_total WHERE status = 'RETOUR')
```

### Eligible Orders for Payout

Orders must:
- `is_vendor_paid = false`
- `status IN ('LIVREE', 'RETOUR')`
- Not already assigned to any payout (via `payout_orders` table)

### Production Total

Computed column in DB:
```sql
production_total = product_cost + printing_cost
```

---

## SQL Views Used

| View | Purpose |
|------|---------|
| `vendor_stats` | Per-vendor aggregated KPIs |
| `vendor_unpaid_orders` | Eligible orders for payout creation |
| `dashboard_kpis` | Global overview numbers |

---

## Auth

- Single admin account via Supabase Auth (email/password)
- All dashboard routes protected by `middleware.ts`
- Webhook route (`/api/webhook`) bypasses auth, uses signature validation
- Service role key used server-side for webhook inserts (bypasses RLS)
