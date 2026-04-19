-- Buyer Peppol discovery result cache.
-- peppol_id (already present) stores the matched identifier (e.g. 0245:1234567890)
-- when a discovery attempt succeeded; NULL otherwise. peppol_checked_at lets us
-- tell "not yet checked" apart from "checked, not present".

ALTER TABLE buyer_contacts
  ADD COLUMN IF NOT EXISTS peppol_checked_at TIMESTAMPTZ;
