-- Add is_vat_payer column to suppliers table
-- Default TRUE (most companies in Slovakia are VAT payers)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_vat_payer boolean DEFAULT true;
