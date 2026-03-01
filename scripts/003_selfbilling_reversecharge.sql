-- Add invoice_mode column to invoices table
-- Values: 'standard' (default), 'selfbilling', 'reversecharge'
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_mode TEXT DEFAULT 'standard';
