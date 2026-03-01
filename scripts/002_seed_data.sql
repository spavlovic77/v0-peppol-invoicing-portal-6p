-- ============================================================
-- SEED DATA -- Slovak VAT rates
-- Run AFTER 001_master_schema.sql
-- ============================================================

-- Slovak VAT rates effective from 2025-01-01
-- Source: Z\u00E1kon \u010D. 222/2004 Z.z. o dani z pridanej hodnoty
INSERT INTO vat_rates (rate, label_sk, label_en, category_id, valid_from, is_active, sort_order) VALUES
  (23.00, 'Z\u00E1kladn\u00E1 sadzba (od 2025)',     'Standard rate (from 2025)',    'S', '2025-01-01', TRUE,  10),
  (19.00, 'Zn\u00ED\u017Een\u00E1 sadzba (od 2025)', 'Reduced rate (from 2025)',     'S', '2025-01-01', TRUE,  20),
  (10.00, 'Zn\u00ED\u017Een\u00E1 sadzba',           'Reduced rate',                 'S', '2025-01-01', TRUE,  30),
  (5.00,  'Zn\u00ED\u017Een\u00E1 sadzba',           'Super-reduced rate',           'S', '2025-01-01', TRUE,  40),
  (0.00,  'Osloboden\u00E9 od dane',                  'Exempt / zero rate',           'O', '2025-01-01', TRUE,  50)
ON CONFLICT (rate) DO UPDATE SET
  label_sk    = EXCLUDED.label_sk,
  label_en    = EXCLUDED.label_en,
  category_id = EXCLUDED.category_id,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;

-- Historical rate (inactive, kept for older invoices)
INSERT INTO vat_rates (rate, label_sk, label_en, category_id, valid_from, valid_to, is_active, sort_order) VALUES
  (20.00, 'Z\u00E1kladn\u00E1 sadzba (do 2024)',     'Standard rate (until 2024)',   'S', '2004-01-01', '2024-12-31', FALSE, 60)
ON CONFLICT (rate) DO UPDATE SET
  label_sk    = EXCLUDED.label_sk,
  label_en    = EXCLUDED.label_en,
  valid_to    = EXCLUDED.valid_to,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;
