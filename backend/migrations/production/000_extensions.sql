-- ============================================================================
-- 000_extensions.sql
-- Park Lofts Rent Manager, Supabase production, base extensions
-- ============================================================================
-- Safe to re-run. Enables UUID generation, cryptography and case-insensitive
-- text for email fields.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "citext";
