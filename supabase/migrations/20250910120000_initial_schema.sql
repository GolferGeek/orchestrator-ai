-- Migration: Create initial schema and seed core data
-- Description: Sets up the essential tables (users, pseudonym_dictionaries) and seeds them.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50),
    roles JSONB
);

-- Seed the demo user
INSERT INTO public.users (id, email, display_name, role, roles)
VALUES ('b29a590e-b07f-49df-a25b-574c956b5035', 'demo.user@playground.com', 'Demo User', 'admin', '["admin", "user"]'::jsonb);

-- Pseudonym Dictionary Table
CREATE TABLE public.pseudonym_dictionaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_value TEXT UNIQUE NOT NULL,
    pseudonym TEXT NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

-- Seed the pseudonym dictionary
INSERT INTO public.pseudonym_dictionaries
  (original_value, pseudonym, data_type, category, is_active)
VALUES
  ('Matt Weber', '[PERSON_NAME_001]', 'name', 'core_entities', TRUE),
  ('GolferGeek', '[USERNAME_001]', 'username', 'core_entities', TRUE),
  ('Orchestrator AI', '[ORGANIZATION_001]', 'organization', 'core_entities', TRUE);
