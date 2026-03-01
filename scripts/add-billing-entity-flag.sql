-- Add is_billing_entity flag to suppliers table
-- Only one supplier per user should be flagged as the billing entity
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_billing_entity boolean NOT NULL DEFAULT false;

-- Create a partial unique index to enforce at most one billing entity per user
-- (This prevents two suppliers for the same user both having is_billing_entity = true)
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_one_billing_per_user
  ON suppliers (user_id)
  WHERE is_billing_entity = true;
