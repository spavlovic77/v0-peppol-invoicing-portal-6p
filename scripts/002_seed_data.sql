-- ============================================================
-- SEED DATA -- Slovak VAT rates reference table
-- Run AFTER 001_master_schema.sql
-- ============================================================

-- --------------------------------------------------------
-- VAT Rates reference table (read-only, no RLS needed)
-- Used by the application for dropdowns and validation
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

-- Slovak VAT rates effective from 2025-01-01
-- Source: Zakon c. 222/2004 Z.z. o dani z pridanej hodnoty
INSERT INTO vat_rates (rate, label_sk, label_en, category_id, valid_from, is_active, sort_order) VALUES
  (23.00, 'Zakladna sadzba (od 2025)',         'Standard rate (from 2025)',         'S', '2025-01-01', TRUE,  10),
  (19.00, 'Znizena sadzba (od 2025)',           'Reduced rate (from 2025)',          'S', '2025-01-01', TRUE,  20),
  (10.00, 'Znizena sadzba',                     'Reduced rate',                     'S', '2025-01-01', TRUE,  30),
  (5.00,  'Znizena sadzba',                     'Super-reduced rate',               'S', '2025-01-01', TRUE,  40),
  (0.00,  'Oslobodene od dane',                  'Exempt / zero rate',               'O', '2025-01-01', TRUE,  50)
ON CONFLICT (rate) DO UPDATE SET
  label_sk   = EXCLUDED.label_sk,
  label_en   = EXCLUDED.label_en,
  category_id = EXCLUDED.category_id,
  is_active  = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- Historical rates (inactive, for reference on older invoices)
INSERT INTO vat_rates (rate, label_sk, label_en, category_id, valid_from, valid_to, is_active, sort_order) VALUES
  (20.00, 'Zakladna sadzba (do 2024)',          'Standard rate (until 2024)',        'S', '2004-01-01', '2024-12-31', FALSE, 60)
ON CONFLICT (rate) DO UPDATE SET
  label_sk   = EXCLUDED.label_sk,
  label_en   = EXCLUDED.label_en,
  valid_to   = EXCLUDED.valid_to,
  is_active  = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
