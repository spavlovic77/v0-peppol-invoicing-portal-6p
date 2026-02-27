-- Company Profiles
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ico VARCHAR(8) NOT NULL,
  dic VARCHAR(12),
  ic_dph VARCHAR(14),
  company_name TEXT NOT NULL,
  street TEXT,
  city TEXT,
  postal_code VARCHAR(10),
  country_code VARCHAR(2) DEFAULT 'SK',
  bank_name TEXT,
  iban VARCHAR(34),
  swift VARCHAR(11),
  email TEXT,
  phone TEXT,
  web TEXT,
  registration_court TEXT,
  registration_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON company_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON company_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON company_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON company_profiles FOR DELETE USING (auth.uid() = id);

-- Invoice Sequences
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_number INTEGER DEFAULT 0,
  prefix VARCHAR(10) DEFAULT 'FV',
  UNIQUE(user_id, year)
);

ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sequences_select_own" ON invoice_sequences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sequences_insert_own" ON invoice_sequences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sequences_update_own" ON invoice_sequences FOR UPDATE USING (auth.uid() = user_id);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  delivery_date DATE,
  currency VARCHAR(3) DEFAULT 'EUR',
  buyer_ico VARCHAR(8),
  buyer_dic VARCHAR(12),
  buyer_ic_dph VARCHAR(14),
  buyer_name TEXT NOT NULL,
  buyer_street TEXT,
  buyer_city TEXT,
  buyer_postal_code VARCHAR(10),
  buyer_country_code VARCHAR(2) DEFAULT 'SK',
  buyer_email TEXT,
  buyer_peppol_id TEXT,
  order_reference TEXT,
  buyer_reference TEXT,
  payment_means_code VARCHAR(3) DEFAULT '30',
  bank_name TEXT,
  iban VARCHAR(34),
  swift VARCHAR(11),
  variable_symbol VARCHAR(10),
  total_without_vat DECIMAL(12,2),
  total_vat DECIMAL(12,2),
  total_with_vat DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'draft',
  xml_content TEXT,
  validation_errors JSONB,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_select_own" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own" ON invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own" ON invoices FOR DELETE USING (auth.uid() = user_id);

-- Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(10) DEFAULT 'C62',
  unit_price DECIMAL(12,4) NOT NULL,
  vat_category VARCHAR(3) DEFAULT 'S',
  vat_rate DECIMAL(5,2) DEFAULT 20.00,
  line_total DECIMAL(12,2) NOT NULL,
  item_number TEXT,
  buyer_item_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select_own" ON invoice_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "items_insert_own" ON invoice_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "items_update_own" ON invoice_items FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "items_delete_own" ON invoice_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
