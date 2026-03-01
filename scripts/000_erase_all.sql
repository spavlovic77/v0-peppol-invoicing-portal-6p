-- ============================================================
-- ERASE ALL DATA -- Full factory reset
-- Drops all app tables, triggers, functions, and auth users.
-- Run this BEFORE 001_master_schema.sql for a clean install.   
-- ============================================================

-- 1. Drop triggers first (depend on tables + function)
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
DROP TRIGGER IF EXISTS update_company_profiles_updated_at ON company_profiles;
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
DROP TRIGGER IF EXISTS update_buyer_contacts_updated_at ON buyer_contacts;

-- 2. Drop tables in dependency order (children first)
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS invoice_sequences CASCADE;
DROP TABLE IF EXISTS buyer_contacts CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS company_profiles CASCADE;
DROP TABLE IF EXISTS vat_rates CASCADE;

-- 3. Drop functions
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- 4. Delete all auth users (cascade removes auth.identities etc.)
DELETE FROM auth.users;
