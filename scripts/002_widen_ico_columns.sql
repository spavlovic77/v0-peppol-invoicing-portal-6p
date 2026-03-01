-- Widen all ICO columns from VARCHAR(8) to VARCHAR(20)
-- to accommodate foreign company identifiers and avoid truncation errors
ALTER TABLE company_profiles ALTER COLUMN ico TYPE VARCHAR(20);
ALTER TABLE suppliers        ALTER COLUMN ico TYPE VARCHAR(20);
ALTER TABLE buyer_contacts   ALTER COLUMN ico TYPE VARCHAR(20);
ALTER TABLE invoices         ALTER COLUMN buyer_ico TYPE VARCHAR(20);
