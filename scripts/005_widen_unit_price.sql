-- Migration: widen unit_price precision from 4 to 5 decimal places
--
-- Allows entering prices like 0.12345 per unit without truncation.
-- Existing data is untouched (4-decimal values remain valid in a
-- 5-decimal column).
--
-- Run manually:
--   psql "$DATABASE_URL" -f scripts/005_widen_unit_price.sql

BEGIN;

ALTER TABLE invoice_items
  ALTER COLUMN unit_price TYPE NUMERIC(12,5);

COMMIT;
