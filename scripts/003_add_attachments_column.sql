-- Add attachments column to invoices table for EN16931 BG-24 supporting documents
-- Stores array of {id, filename, mimeCode, description, data, size} objects
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
