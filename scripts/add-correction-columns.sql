-- Add correction/credit note columns to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type_code text DEFAULT '380';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS correction_of uuid REFERENCES invoices(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS correction_reason text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_reference_number text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_reference_date text;

-- Index for finding corrections of a given invoice
CREATE INDEX IF NOT EXISTS idx_invoices_correction_of ON invoices(correction_of) WHERE correction_of IS NOT NULL;
