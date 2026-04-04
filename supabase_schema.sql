-- ============================================================
-- VENDORS DASHBOARD — Supabase PostgreSQL Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE order_status AS ENUM (
  'EN_LIVRAISON',
  'LIVREE',
  'RETOUR',
  'ECHANGE'
);

CREATE TYPE payout_status AS ENUM (
  'EN_ATTENTE',
  'SENT'
);

-- ============================================================
-- 1. VENDORS
-- ============================================================

CREATE TABLE vendors (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT NOT NULL,
  phone     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ORDERS
-- ============================================================

CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_ref         TEXT UNIQUE NOT NULL,
  client_phone      TEXT,
  product_id        TEXT,
  vendor_id         UUID REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name       TEXT,                          -- redundancy from webhook
  product_cost      NUMERIC(10,2) DEFAULT 0,
  printing_cost     NUMERIC(10,2) DEFAULT 0,
  production_total  NUMERIC(10,2) GENERATED ALWAYS AS (product_cost + printing_cost) STORED,
  vendor_benefice   NUMERIC(10,2) DEFAULT 0,
  merch_benefice    NUMERIC(10,2) DEFAULT 0,
  status            order_status DEFAULT 'EN_LIVRAISON',
  note              TEXT,
  is_vendor_paid    BOOLEAN DEFAULT FALSE,
  is_supplier_paid  BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX idx_orders_status    ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ============================================================
-- 3. PAYOUTS
-- ============================================================

CREATE TABLE payouts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id             UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  total_orders          INTEGER DEFAULT 0,
  total_vendor_benefice NUMERIC(10,2) DEFAULT 0,
  retour_loss           NUMERIC(10,2) DEFAULT 0,
  net_payout            NUMERIC(10,2) GENERATED ALWAYS AS (total_vendor_benefice - retour_loss) STORED,
  date                  TIMESTAMPTZ DEFAULT NOW(),
  status                payout_status DEFAULT 'EN_ATTENTE',
  note                  TEXT
);

CREATE INDEX idx_payouts_vendor_id ON payouts(vendor_id);

-- ============================================================
-- 4. PAYOUT_ORDERS (many-to-many relation)
-- ============================================================

CREATE TABLE payout_orders (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_id  UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE(payout_id, order_id)
);

CREATE INDEX idx_payout_orders_payout_id ON payout_orders(payout_id);
CREATE INDEX idx_payout_orders_order_id  ON payout_orders(order_id);

-- ============================================================
-- 5. SUPPLIER PAYMENTS
-- ============================================================

CREATE TABLE supplier_payments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount     NUMERIC(10,2) NOT NULL,
  note       TEXT,
  date       TIMESTAMPTZ DEFAULT NOW(),
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL  -- optional relation
);

CREATE INDEX idx_supplier_payments_order_id ON supplier_payments(order_id);

-- ============================================================
-- VIEWS
-- ============================================================

-- Vendor performance summary
CREATE OR REPLACE VIEW vendor_stats AS
SELECT
  v.id                                                          AS vendor_id,
  v.name                                                        AS vendor_name,
  COUNT(o.id)                                                   AS total_orders,
  COUNT(o.id) FILTER (WHERE o.status = 'LIVREE')               AS delivered_orders,
  COUNT(o.id) FILTER (WHERE o.status = 'RETOUR')               AS retour_orders,
  COALESCE(SUM(o.vendor_benefice) FILTER (WHERE o.status = 'LIVREE'), 0)         AS total_benefice,
  COALESCE(SUM(o.production_total) FILTER (WHERE o.status = 'RETOUR'), 0)        AS total_retour_loss,
  COALESCE(SUM(o.vendor_benefice) FILTER (WHERE o.status = 'LIVREE'), 0)
    - COALESCE(SUM(o.production_total) FILTER (WHERE o.status = 'RETOUR'), 0)    AS net_vendor_profit,
  COALESCE(SUM(o.merch_benefice) FILTER (WHERE o.status = 'LIVREE'), 0)          AS merch_total_profit
FROM vendors v
LEFT JOIN orders o ON o.vendor_id = v.id
GROUP BY v.id, v.name;

-- Unpaid (eligible) orders per vendor for payout creation
CREATE OR REPLACE VIEW vendor_unpaid_orders AS
SELECT
  o.*,
  v.name AS vendor_name_ref
FROM orders o
JOIN vendors v ON v.id = o.vendor_id
WHERE
  o.is_vendor_paid = FALSE
  AND o.status IN ('LIVREE', 'RETOUR')
  AND o.id NOT IN (SELECT order_id FROM payout_orders);

-- Dashboard KPI summary
CREATE OR REPLACE VIEW dashboard_kpis AS
SELECT
  COUNT(*)                                                      AS total_orders,
  COUNT(*) FILTER (WHERE status = 'LIVREE')                    AS total_delivered,
  COUNT(*) FILTER (WHERE status = 'RETOUR')                    AS total_retour,
  COUNT(*) FILTER (WHERE status = 'EN_LIVRAISON')              AS total_in_delivery,
  COALESCE(SUM(merch_benefice) FILTER (WHERE status = 'LIVREE'), 0)  AS total_merch_profit,
  COALESCE(SUM(vendor_benefice) FILTER (WHERE status = 'LIVREE'), 0) AS total_vendor_profit,
  COALESCE(SUM(production_total), 0)                           AS total_production_cost
FROM orders;

-- ============================================================
-- ROW LEVEL SECURITY (single admin — lock down by default)
-- ============================================================

ALTER TABLE vendors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- Authenticated users (admin) get full access
CREATE POLICY "admin_all" ON vendors           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON orders            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON payouts           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON payout_orders     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON supplier_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role (webhook) bypass: handled by SUPABASE_SERVICE_ROLE_KEY on server
-- No extra policy needed — service role bypasses RLS by default.
