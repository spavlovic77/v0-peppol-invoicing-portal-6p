-- Peppol registration (ion-AP multiaccount model B)
-- The admin token handles all API calls; we just store the ion-AP Organization ID per supplier.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS peppol_organization_id INTEGER,
  ADD COLUMN IF NOT EXISTS peppol_registered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_suppliers_peppol_org_id
  ON suppliers (peppol_organization_id)
  WHERE peppol_organization_id IS NOT NULL;
