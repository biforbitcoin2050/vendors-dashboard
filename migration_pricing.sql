-- migration_pricing.sql
-- Run this in the Supabase SQL Editor to migrate from the old schema
-- (product_cost, printing_cost, vendor_benefice, merch_benefice)
-- to the new schema defined in .MD
-- (prix_client, prix_fournisseur, benefice_merch, prix_vendeur [computed], benefice_vendeur [computed])
--
-- SAFE TO RUN: uses IF NOT EXISTS / IF EXISTS to be idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- STEP 1: Add new columns (if they don't already exist)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS prix_client        NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prix_fournisseur   NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benefice_merch     NUMERIC NOT NULL DEFAULT 0;

-- STEP 2: Copy data from old columns into new columns (where old columns exist)
DO $$
BEGIN
  -- Migrate product_cost + printing_cost → prix_fournisseur
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'product_cost'
  ) THEN
    UPDATE orders
    SET prix_fournisseur = COALESCE(product_cost, 0) + COALESCE(printing_cost, 0)
    WHERE prix_fournisseur = 0;
  END IF;

  -- Migrate merch_benefice → benefice_merch
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'merch_benefice'
  ) THEN
    UPDATE orders
    SET benefice_merch = COALESCE(merch_benefice, 0)
    WHERE benefice_merch = 0;
  END IF;

  -- Migrate vendor_benefice (old) → benefice_vendeur migration
  -- Note: in the new schema benefice_vendeur is computed automatically
  -- so we only need to set prix_client if it's not already set
  -- (prix_client should come from WooCommerce payload.total)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'vendor_benefice'
  ) THEN
    -- prix_client can be estimated as prix_fournisseur + benefice_merch + vendor_benefice
    UPDATE orders
    SET prix_client = prix_fournisseur + benefice_merch + COALESCE(vendor_benefice, 0)
    WHERE prix_client = 0 AND (prix_fournisseur > 0 OR benefice_merch > 0);
  END IF;
END $$;

-- STEP 3: Add computed columns for prix_vendeur and benefice_vendeur
-- Drop old computed columns first if they exist under different names
ALTER TABLE orders
  DROP COLUMN IF EXISTS production_total;

-- Add prix_vendeur as a generated column
ALTER TABLE orders
  DROP COLUMN IF EXISTS prix_vendeur;

ALTER TABLE orders
  ADD COLUMN prix_vendeur NUMERIC GENERATED ALWAYS AS (prix_fournisseur + benefice_merch) STORED;

-- Add benefice_vendeur as a generated column
ALTER TABLE orders
  DROP COLUMN IF EXISTS benefice_vendeur;

ALTER TABLE orders
  ADD COLUMN benefice_vendeur NUMERIC GENERATED ALWAYS AS (prix_client - (prix_fournisseur + benefice_merch)) STORED;

-- STEP 4: Drop old columns (uncomment when you're sure migration is correct)
-- ALTER TABLE orders DROP COLUMN IF EXISTS product_cost;
-- ALTER TABLE orders DROP COLUMN IF EXISTS printing_cost;
-- ALTER TABLE orders DROP COLUMN IF EXISTS vendor_benefice;
-- ALTER TABLE orders DROP COLUMN IF EXISTS merch_benefice;

-- STEP 5: Recreate vendor_stats view with new column names
DROP VIEW IF EXISTS vendor_stats;

CREATE VIEW vendor_stats AS
SELECT
  v.id                                              AS vendor_id,
  v.name                                            AS vendor_name,
  COUNT(o.id)                                       AS total_orders,
  COUNT(o.id) FILTER (WHERE o.status = 'LIVREE')    AS delivered_orders,
  COUNT(o.id) FILTER (WHERE o.status = 'RETOUR')    AS retour_orders,
  COALESCE(SUM(o.benefice_vendeur) FILTER (WHERE o.status = 'LIVREE'), 0) AS total_benefice,
  COALESCE(SUM(o.prix_vendeur)     FILTER (WHERE o.status = 'RETOUR'), 0) AS total_retour_loss,
  COALESCE(SUM(o.benefice_vendeur) FILTER (WHERE o.status = 'LIVREE'), 0)
    - COALESCE(SUM(o.prix_vendeur) FILTER (WHERE o.status = 'RETOUR'), 0) AS net_vendor_profit,
  COALESCE(SUM(o.benefice_merch)   FILTER (WHERE o.status = 'LIVREE'), 0) AS merch_total_profit,
  COALESCE(SUM(o.prix_client)      FILTER (WHERE o.status = 'LIVREE'), 0) AS total_revenue
FROM vendors v
LEFT JOIN orders o ON o.vendor_id = v.id
GROUP BY v.id, v.name;

-- STEP 6: Recreate vendor_unpaid_orders view
DROP VIEW IF EXISTS vendor_unpaid_orders;

CREATE VIEW vendor_unpaid_orders AS
SELECT *
FROM orders
WHERE is_vendor_paid = false
  AND status IN ('LIVREE', 'RETOUR')
  AND id NOT IN (
    SELECT order_id FROM payout_orders
  );

-- STEP 7: Recreate dashboard_kpis view
DROP VIEW IF EXISTS dashboard_kpis;

CREATE VIEW dashboard_kpis AS
SELECT
  COUNT(*)                                            AS total_orders,
  COUNT(*) FILTER (WHERE status = 'LIVREE')           AS total_delivered,
  COUNT(*) FILTER (WHERE status = 'RETOUR')           AS total_retour,
  COUNT(*) FILTER (WHERE status = 'EN_LIVRAISON')     AS total_in_delivery,
  COALESCE(SUM(benefice_merch)   FILTER (WHERE status = 'LIVREE'), 0) AS total_merch_profit,
  COALESCE(SUM(benefice_vendeur) FILTER (WHERE status = 'LIVREE'), 0) AS total_vendor_profit,
  COALESCE(SUM(prix_fournisseur) FILTER (WHERE status = 'LIVREE'), 0) AS total_production_cost,
  COALESCE(SUM(prix_client)      FILTER (WHERE status = 'LIVREE'), 0) AS total_revenue
FROM orders;

-- Done ✓
-- After running, verify with:
--   SELECT * FROM dashboard_kpis;
--   SELECT * FROM vendor_stats LIMIT 5;
--   SELECT * FROM vendor_unpaid_orders LIMIT 5;
