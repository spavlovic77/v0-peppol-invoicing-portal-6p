-- Migration: Peppol BIS 3 allowance/charge extension
--
-- Adds line-level charges (BT-141), item price base quantity (BT-149) and
-- reason codes (UNTDID 5189 / 7161) on invoice_items, plus document-level
-- charges (BT-99) and reason codes on invoices. Existing rows are backfilled
-- with the declared defaults.
--
-- Run manually:
--   psql "$DATABASE_URL" -f scripts/003_allowance_charge_extension.sql

BEGIN;

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS base_quantity         NUMERIC(12,3) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allowance_reason_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS charge_percent        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charge_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charge_reason_code    VARCHAR(10);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS global_discount_reason_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS global_charge_percent       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS global_charge_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS global_charge_reason_code   VARCHAR(10);

COMMIT;
