-- ============================================================
-- VENDORS DASHBOARD — FRESH DATABASE SCHEMA
-- Merch By DZ · Run this in Supabase SQL Editor
-- Deletes everything and rebuilds from scratch
--
-- NOTE: Uses triggers (not GENERATED ALWAYS) so n8n and any
-- external tool can send ANY field without errors.
-- The trigger always overwrites computed values with the
-- correct formula on every INSERT and UPDATE.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. CLEAN SLATE — Drop everything in correct order
-- ────────────────────────────────────────────────────────────

DROP VIEW     IF EXISTS dashboard_kpis              CASCADE;
DROP VIEW     IF EXISTS vendor_stats                CASCADE;
DROP VIEW     IF EXISTS vendor_unpaid_orders        CASCADE;

DROP TRIGGER  IF EXISTS trg_orders_compute          ON orders;
DROP TRIGGER  IF EXISTS trg_payouts_compute         ON payouts;
DROP FUNCTION IF EXISTS fn_orders_compute()         CASCADE;
DROP FUNCTION IF EXISTS fn_payouts_compute()        CASCADE;

DROP TABLE IF EXISTS payout_orders                  CASCADE;
DROP TABLE IF EXISTS payouts                        CASCADE;
DROP TABLE IF EXISTS supplier_payments              CASCADE;
DROP TABLE IF EXISTS orders                         CASCADE;
DROP TABLE IF EXISTS vendors                        CASCADE;

DROP TYPE  IF EXISTS order_status                   CASCADE;
DROP TYPE  IF EXISTS payout_status                  CASCADE;


-- ────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ────────────────────────────────────────────────────────────

-- Note: order_status is NOT an ENUM — using TEXT so CSV imports with any case work.
-- The trigger normalizes the value to uppercase automatically.
-- Valid values: EN_LIVRAISON, LIVREE, RETOUR, ECHANGE
CREATE TYPE payout_status AS ENUM ('EN_ATTENTE', 'SENT');


-- ────────────────────────────────────────────────────────────
-- 2. TABLES
-- ────────────────────────────────────────────────────────────

-- 2.1 vendors
-- id is TEXT (not UUID) so WooCommerce numeric vendor IDs work directly
CREATE TABLE vendors (
  id         TEXT        PRIMARY KEY,          -- WooCommerce vendor ID (e.g. "1416") or auto UUID
  name       TEXT        NOT NULL,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 orders
-- prix_vendeur and benefice_vendeur are regular columns.
-- They are auto-computed by the trigger below on every INSERT/UPDATE.
-- n8n (or any tool) can freely include or omit them — the trigger wins.
CREATE TABLE orders (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref        TEXT         NOT NULL UNIQUE,
  client_phone     TEXT,
  product_id       TEXT,
  vendor_id        TEXT         REFERENCES vendors(id) ON DELETE SET NULL,  -- WooCommerce vendor ID
  vendor_name      TEXT,

  -- Input pricing fields (nullable so empty CSV cells import as NULL → stored as 0)
  prix_client      NUMERIC      DEFAULT 0,  -- from WooCommerce (payload.total)
  prix_fournisseur NUMERIC      DEFAULT 0,  -- entered manually by employee
  benefice_merch   NUMERIC      DEFAULT 0,  -- entered manually by employee

  -- Auto-computed (overwritten by trigger — safe to send from n8n or leave empty)
  prix_vendeur     NUMERIC      DEFAULT 0,  -- = prix_fournisseur + benefice_merch
  benefice_vendeur NUMERIC      DEFAULT 0,  -- = prix_client - prix_vendeur

  -- TEXT (not ENUM) so any case works from CSV/n8n: en_livraison, Retour, LIVREE...
  -- Trigger normalizes to uppercase before storing.
  status           TEXT         NOT NULL DEFAULT 'EN_LIVRAISON',
  note             TEXT,
  is_vendor_paid   BOOLEAN      DEFAULT false,  -- nullable: trigger sets false if empty
  is_supplier_paid BOOLEAN      DEFAULT false,  -- nullable: trigger sets false if empty
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2.3 payouts
-- net_payout is a regular column, auto-computed by trigger.
CREATE TABLE payouts (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id             TEXT          NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,  -- WooCommerce vendor ID
  total_orders          INTEGER       NOT NULL DEFAULT 0,
  total_vendor_benefice NUMERIC       NOT NULL DEFAULT 0,  -- SUM(benefice_vendeur) for LIVRÉE
  retour_loss           NUMERIC       NOT NULL DEFAULT 0,  -- SUM(prix_vendeur) for RETOUR

  -- Auto-computed (overwritten by trigger — safe to send from n8n)
  net_payout            NUMERIC       NOT NULL DEFAULT 0,  -- = total_vendor_benefice - retour_loss

  date                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  status                payout_status NOT NULL DEFAULT 'EN_ATTENTE',
  note                  TEXT
);

-- 2.4 payout_orders (links payouts ↔ orders, prevents double-payment)
CREATE TABLE payout_orders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id  UUID NOT NULL REFERENCES payouts(id)  ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  UNIQUE (payout_id, order_id),
  UNIQUE (order_id)  -- each order can only be in ONE payout
);

-- 2.5 supplier_payments
CREATE TABLE supplier_payments (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  amount   NUMERIC     NOT NULL,
  note     TEXT,
  date     TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id UUID        REFERENCES orders(id) ON DELETE SET NULL
);


-- ────────────────────────────────────────────────────────────
-- 3. TRIGGERS — Auto-compute derived fields
-- ────────────────────────────────────────────────────────────

-- 3.1 orders: compute prix_vendeur and benefice_vendeur
--     Runs BEFORE INSERT OR UPDATE so the stored value is always correct.
--     n8n can send ANY value for these fields — trigger overwrites them.

CREATE OR REPLACE FUNCTION fn_orders_compute()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize status to uppercase (handles en_livraison, Retour, LIVREE, retour...)
  NEW.status := UPPER(COALESCE(NEW.status, 'EN_LIVRAISON'));

  -- COALESCE treats NULL as 0 so empty CSV cells never cause errors
  NEW.prix_vendeur     := COALESCE(NEW.prix_fournisseur, 0) + COALESCE(NEW.benefice_merch, 0);
  NEW.benefice_vendeur := COALESCE(NEW.prix_client, 0) - NEW.prix_vendeur;

  -- Normalize booleans: empty string → false
  NEW.is_vendor_paid   := COALESCE(NEW.is_vendor_paid, false);
  NEW.is_supplier_paid := COALESCE(NEW.is_supplier_paid, false);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_compute
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_orders_compute();

-- 3.2 payouts: compute net_payout
--     Runs BEFORE INSERT OR UPDATE.

CREATE OR REPLACE FUNCTION fn_payouts_compute()
RETURNS TRIGGER AS $$
BEGIN
  NEW.net_payout := NEW.total_vendor_benefice - NEW.retour_loss;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payouts_compute
  BEFORE INSERT OR UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION fn_payouts_compute();


-- ────────────────────────────────────────────────────────────
-- 4. INDEXES (for query performance)
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_orders_vendor_id       ON orders(vendor_id);
CREATE INDEX idx_orders_status          ON orders(status);
CREATE INDEX idx_orders_is_vendor_paid  ON orders(is_vendor_paid);
CREATE INDEX idx_orders_created_at      ON orders(created_at DESC);
CREATE INDEX idx_payouts_vendor_id      ON payouts(vendor_id);
CREATE INDEX idx_payouts_status         ON payouts(status);
CREATE INDEX idx_payout_orders_order_id ON payout_orders(order_id);


-- ────────────────────────────────────────────────────────────
-- 5. VIEWS
-- ────────────────────────────────────────────────────────────

-- 5.1 vendor_stats — aggregated KPIs per vendor
CREATE VIEW vendor_stats AS
SELECT
  v.id                                                                           AS vendor_id,
  v.name                                                                         AS vendor_name,
  COUNT(o.id)                                                                    AS total_orders,
  COUNT(o.id)    FILTER (WHERE o.status = 'LIVREE')                              AS delivered_orders,
  COUNT(o.id)    FILTER (WHERE o.status = 'RETOUR')                              AS retour_orders,
  COALESCE(SUM(o.benefice_vendeur) FILTER (WHERE o.status = 'LIVREE'), 0)        AS total_benefice,
  COALESCE(SUM(o.prix_vendeur)     FILTER (WHERE o.status = 'RETOUR'), 0)        AS total_retour_loss,
  COALESCE(SUM(o.benefice_vendeur) FILTER (WHERE o.status = 'LIVREE'), 0)
    - COALESCE(SUM(o.prix_vendeur) FILTER (WHERE o.status = 'RETOUR'), 0)        AS net_vendor_profit,
  COALESCE(SUM(o.benefice_merch)   FILTER (WHERE o.status = 'LIVREE'), 0)        AS merch_total_profit,
  COALESCE(SUM(o.prix_client)      FILTER (WHERE o.status = 'LIVREE'), 0)        AS total_revenue
FROM vendors v
LEFT JOIN orders o ON o.vendor_id = v.id
GROUP BY v.id, v.name;

-- 5.2 vendor_unpaid_orders — eligible orders for payout wizard
CREATE VIEW vendor_unpaid_orders AS
SELECT o.*
FROM orders o
WHERE o.is_vendor_paid = false
  AND o.status IN ('LIVREE', 'RETOUR')
  AND o.id NOT IN (SELECT order_id FROM payout_orders);

-- 5.3 dashboard_kpis — single-row global summary
CREATE VIEW dashboard_kpis AS
SELECT
  COUNT(*)                                                                 AS total_orders,
  COUNT(*)       FILTER (WHERE status = 'LIVREE')                          AS total_delivered,
  COUNT(*)       FILTER (WHERE status = 'RETOUR')                          AS total_retour,
  COUNT(*)       FILTER (WHERE status = 'EN_LIVRAISON')                    AS total_in_delivery,
  COALESCE(SUM(benefice_merch)   FILTER (WHERE status = 'LIVREE'), 0)      AS total_merch_profit,
  COALESCE(SUM(benefice_vendeur) FILTER (WHERE status = 'LIVREE'), 0)      AS total_vendor_profit,
  COALESCE(SUM(prix_fournisseur) FILTER (WHERE status = 'LIVREE'), 0)      AS total_production_cost,
  COALESCE(SUM(prix_client)      FILTER (WHERE status = 'LIVREE'), 0)      AS total_revenue
FROM orders;


-- ────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

ALTER TABLE vendors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- Full access for authenticated users (admin only)
CREATE POLICY "auth_full_access" ON vendors           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON orders            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON payouts           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON payout_orders     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON supplier_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 7. VERIFY
-- ────────────────────────────────────────────────────────────
-- Run after to confirm everything is correct:
--
--   SELECT * FROM dashboard_kpis;
--   SELECT * FROM vendor_stats;
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'orders'
--    ORDER BY ordinal_position;
--
-- Test trigger behavior:
--   INSERT INTO orders (order_ref, prix_client, prix_fournisseur, benefice_merch)
--   VALUES ('TEST-001', 3500, 800, 200);
--
--   SELECT order_ref, prix_vendeur, benefice_vendeur FROM orders;
--   -- Expected: prix_vendeur = 1000, benefice_vendeur = 2500
--
-- ============================================================
-- DONE ✓
-- ============================================================
