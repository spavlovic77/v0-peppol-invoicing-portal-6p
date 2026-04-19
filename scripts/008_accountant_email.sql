-- Accountant email + "send to accountant" tracking.
-- Each supplier stores the email of its accountant; each invoice records
-- when and to whom it was last emailed (zipped XML + PDF).

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS accountant_email TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_to_accountant_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_accountant_email TEXT;
