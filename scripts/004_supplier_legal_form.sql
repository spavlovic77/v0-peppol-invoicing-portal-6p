-- Migration: add legal_form (BT-33, Seller additional legal information)
--
-- Peppol BIS 3 / EN16931 BT-33 carries the seller's legal registration info
-- as free text on <cac:PartyLegalEntity>/<cbc:CompanyLegalForm>. A typical
-- Slovak value looks like "Obchodný register Okresného súdu Bratislava I,
-- oddiel: sro, vložka č. 123/B".
--
-- Column is nullable so existing rows don't break; the supplier edit form
-- enforces the mandatory rule in the UI on the next save.
--
-- Run manually:
--   psql "$DATABASE_URL" -f scripts/004_supplier_legal_form.sql

BEGIN;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS legal_form TEXT;

COMMIT;
