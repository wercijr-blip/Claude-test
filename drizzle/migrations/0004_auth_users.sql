-- Migration: 0004_auth_users.sql
-- Adds MedScribe auth fields to users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS passwordHash   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS clinicId       VARCHAR(21),
  ADD COLUMN IF NOT EXISTS specialty      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS crm            VARCHAR(30),
  ADD COLUMN IF NOT EXISTS active         INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mustChangePassword INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bulletinEmail  VARCHAR(320),
  ADD COLUMN IF NOT EXISTS receiveMonthlyBulletin INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS email_new      VARCHAR(320),
  ADD COLUMN IF NOT EXISTS name           VARCHAR(255),
  MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'doctor';

-- Migrar nomes legados
UPDATE users SET name = nome WHERE name IS NULL AND nome IS NOT NULL;

-- Renomear role 'user' para 'doctor' em dados existentes
UPDATE users SET role = 'doctor' WHERE role = 'user';
UPDATE users SET role = 'doctor' WHERE role = 'secretaria';
UPDATE users SET role = 'doctor' WHERE role = 'medico';

-- Criar índice único em email (se não existir)
ALTER TABLE users ADD UNIQUE INDEX idx_users_email (email);
