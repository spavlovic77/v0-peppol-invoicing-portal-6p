-- ============================================================
-- MASTER SCHEMA -- Peppol e-Invoicing Portal (Slovakia)
-- Consolidated schema for fresh database install.
-- Run AFTER 000_erase_all.sql on a clean Supabase project.
-- ============================================================

-- --------------------------------------------------------
-- Helper: auto-update updated_at on row changes
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 1. Company Profiles (legacy, 1:1 with auth.users)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ico           VARCHAR(20) NOT NULL,
  dic           VARCHAR(12),
  ic_dph        VARCHAR(14),
  company_name  TEXT NOT NULL,
  street        TEXT,
  city          TEXT,
  postal_code   VARCHAR(10),
  country_code  VARCHAR(2) DEFAULT 'SK',
  bank_name     TEXT,
  iban          VARCHAR(34),
  swift         VARCHAR(11),
  email         TEXT,
  phone         TEXT,
  web           TEXT,
  registration_court  TEXT,
  registration_number TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON company_profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON company_profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON company_profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON company_profiles;
CREATE POLICY "profiles_select_own" ON company_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON company_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON company_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON company_profiles FOR DELETE USING (auth.uid() = id);

DROP TRIGGER IF EXISTS update_company_profiles_updated_at ON company_profiles;
CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------
-- 2. Suppliers (multi-supplier per user)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ico             VARCHAR(8) NOT NULL,
  dic             VARCHAR(12),
  ic_dph          VARCHAR(14),
  company_name    TEXT NOT NULL,
  street          TEXT,
  city            TEXT,
  postal_code     VARCHAR(10),
  country_code    VARCHAR(2) DEFAULT 'SK',
  bank_name       TEXT,
  iban            VARCHAR(34),
  swift           VARCHAR(11),
  email           TEXT,
  phone           TEXT,
  web             TEXT,
  registration_court  TEXT,
  registration_number TEXT,
  ap_api_key      TEXT,
  is_vat_payer    BOOLEAN DEFAULT TRUE,
  is_billing_entity BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_select_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete_own" ON suppliers;
CREATE POLICY "suppliers_select_own" ON suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "suppliers_insert_own" ON suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suppliers_update_own" ON suppliers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "suppliers_delete_own" ON suppliers FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enforce at most one billing entity per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_one_billing_per_user
  ON suppliers (user_id)
  WHERE is_billing_entity = true;

-- --------------------------------------------------------
-- 3. Buyer Contacts (per supplier)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyer_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  ico             VARCHAR(20),
  dic             VARCHAR(12),
  ic_dph          VARCHAR(14),
  company_name    TEXT NOT NULL,
  street          TEXT,
  city            TEXT,
  postal_code     VARCHAR(10),
  country_code    VARCHAR(2) DEFAULT 'SK',
  peppol_id       TEXT,
  email           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE buyer_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "buyers_select_own" ON buyer_contacts;
DROP POLICY IF EXISTS "buyers_insert_own" ON buyer_contacts;
DROP POLICY IF EXISTS "buyers_update_own" ON buyer_contacts;
DROP POLICY IF EXISTS "buyers_delete_own" ON buyer_contacts;
CREATE POLICY "buyers_select_own" ON buyer_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "buyers_insert_own" ON buyer_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "buyers_update_own" ON buyer_contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "buyers_delete_own" ON buyer_contacts FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_buyer_contacts_updated_at ON buyer_contacts;
CREATE TRIGGER update_buyer_contacts_updated_at
  BEFORE UPDATE ON buyer_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------
-- 4. Invoice Sequences (auto-numbering per supplier+year)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  last_number INTEGER DEFAULT 0,
  prefix      VARCHAR(10) DEFAULT 'FV',
  UNIQUE(user_id, supplier_id, year, prefix)
);

ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sequences_select_own" ON invoice_sequences;
DROP POLICY IF EXISTS "sequences_insert_own" ON invoice_sequences;
DROP POLICY IF EXISTS "sequences_update_own" ON invoice_sequences;
CREATE POLICY "sequences_select_own" ON invoice_sequences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sequences_insert_own" ON invoice_sequences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sequences_update_own" ON invoice_sequences FOR UPDATE USING (auth.uid() = user_id);

-- --------------------------------------------------------
-- 5. Invoices
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id             UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Document identity
  invoice_number          VARCHAR(50) NOT NULL,
  invoice_type_code       TEXT DEFAULT '380',        -- 380=Invoice, 381=CreditNote
  invoice_mode            TEXT DEFAULT 'standard',   -- standard, selfbilling, reversecharge
  issue_date              DATE NOT NULL,
  due_date                DATE NOT NULL,
  delivery_date           DATE,
  currency                VARCHAR(3) DEFAULT 'EUR',

  -- Buyer
  buyer_ico               VARCHAR(20),
  buyer_dic               VARCHAR(12),
  buyer_ic_dph            VARCHAR(14),
  buyer_name              TEXT NOT NULL,
  buyer_street            TEXT,
  buyer_city              TEXT,
  buyer_postal_code       VARCHAR(10),
  buyer_country_code      VARCHAR(2) DEFAULT 'SK',
  buyer_email             TEXT,
  buyer_peppol_id         TEXT,
  buyer_reference         TEXT,
  order_reference         TEXT,

  -- Payment
  payment_means_code      VARCHAR(3) DEFAULT '30',
  bank_name               TEXT,
  iban                    VARCHAR(34),
  swift                   VARCHAR(11),
  variable_symbol         VARCHAR(10),

  -- Discounts
  global_discount_percent NUMERIC(5,2) DEFAULT 0,
  global_discount_amount  NUMERIC(12,2) DEFAULT 0,

  -- Totals
  total_without_vat       NUMERIC(12,2),
  total_vat               NUMERIC(12,2),
  total_with_vat          NUMERIC(12,2),

  -- Status & validation
  status                  VARCHAR(20) DEFAULT 'draft',
  xml_content             TEXT,
  validation_errors       JSONB,
  note                    TEXT,

  -- Correction / credit note fields
  correction_of           UUID REFERENCES invoices(id),
  correction_reason       TEXT,
  billing_reference_number TEXT,
  billing_reference_date  TEXT,

  -- Peppol delivery
  peppol_send_status      TEXT,
  peppol_sent_at          TIMESTAMPTZ,
  peppol_transaction_id   TEXT,

  -- Legacy AI columns (kept for backward compat, unused)
  ai_prompt_tokens        INTEGER,
  ai_completion_tokens    INTEGER,
  ai_total_tokens         INTEGER,
  ai_cost_usd             NUMERIC(10,6),
  ai_model                TEXT,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_select_own" ON invoices;
DROP POLICY IF EXISTS "invoices_insert_own" ON invoices;
DROP POLICY IF EXISTS "invoices_update_own" ON invoices;
DROP POLICY IF EXISTS "invoices_delete_own" ON invoices;
CREATE POLICY "invoices_select_own" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own" ON invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own" ON invoices FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_correction_of ON invoices(correction_of) WHERE correction_of IS NOT NULL;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------
-- 6. Invoice Items
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number       INTEGER NOT NULL,
  description       TEXT NOT NULL,
  quantity          NUMERIC(12,3) NOT NULL,
  unit              VARCHAR(10) DEFAULT 'C62',
  unit_price        NUMERIC(12,4) NOT NULL,
  vat_category      VARCHAR(3) DEFAULT 'S',
  vat_rate          NUMERIC(5,2) NOT NULL DEFAULT 23.00,
  discount_percent  NUMERIC(5,2) DEFAULT 0,
  discount_amount   NUMERIC(12,2) DEFAULT 0,
  line_total        NUMERIC(12,2) NOT NULL,
  item_number       TEXT,
  buyer_item_number TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_select_own" ON invoice_items;
DROP POLICY IF EXISTS "items_insert_own" ON invoice_items;
DROP POLICY IF EXISTS "items_update_own" ON invoice_items;
DROP POLICY IF EXISTS "items_delete_own" ON invoice_items;
CREATE POLICY "items_select_own" ON invoice_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "items_insert_own" ON invoice_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "items_update_own" ON invoice_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "items_delete_own" ON invoice_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- --------------------------------------------------------
-- 7. VAT Rates (reference table, read-only)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS vat_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate        NUMERIC(5,2) NOT NULL UNIQUE,
  label_sk    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  category_id VARCHAR(3) NOT NULL DEFAULT 'S',
  valid_from  DATE NOT NULL DEFAULT '2025-01-01',
  valid_to    DATE,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- 8. Seed Data -- Slovak VAT rates
-- Source: Zákon č. 222/2004 Z.z. o dani z pridanej hodnoty
-- --------------------------------------------------------
INSERT INTO vat_rates (rate, label_sk, label_en, category_id, valid_from, is_active, sort_order) VALUES
  (23.00, 'Základná sadzba (od 2025)',     'Standard rate (from 2025)',    'S', '2025-01-01', TRUE,  10),
  (19.00, 'Znížená sadzba (od 2025)',      'Reduced rate (from 2025)',     'S', '2025-01-01', TRUE,  20),
  (10.00, 'Znížená sadzba',               'Reduced rate',                 'S', '2025-01-01', TRUE,  30),
  (5.00,  'Znížená sadzba',               'Super-reduced rate',           'S', '2025-01-01', TRUE,  40),
  (0.00,  'Oslobodené od dane',            'Exempt / zero rate',           'O', '2025-01-01', TRUE,  50)
ON CONFLICT (rate) DO UPDATE SET
  label_sk    = EXCLUDED.label_sk,
  label_en    = EXCLUDED.label_en,
  category_id = EXCLUDED.category_id,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;

-- Historical rate (inactive, kept for older invoices)
INSERT INTO vat_rates (rate, label_sk, label_en, category_id, valid_from, valid_to, is_active, sort_order) VALUES
  (20.00, 'Základná sadzba (do 2024)',     'Standard rate (until 2024)',   'S', '2004-01-01', '2024-12-31', FALSE, 60)
ON CONFLICT (rate) DO UPDATE SET
  label_sk    = EXCLUDED.label_sk,
  label_en    = EXCLUDED.label_en,
  valid_to    = EXCLUDED.valid_to,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;
