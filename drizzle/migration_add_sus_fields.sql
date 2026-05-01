-- ════════════════════════════════════════════════════════════════
-- Migration: campos novos para integração SUS + nome da mãe + modalidade PrEP
-- Tabela afetada: pacientes
-- Total: 11 colunas novas
--
-- Aplicar via:
--   pnpm db:push                   ← preferido (sincroniza com schema.ts)
--   ou rodar este SQL manualmente no MySQL/TiDB
--
-- TiDB e MySQL 8+ suportam IF NOT EXISTS — script idempotente.
-- ════════════════════════════════════════════════════════════════

-- Step 1 — Dados Pessoais
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS nome_mae_encrypted TEXT;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS cns VARCHAR(20);

-- Step 2 — Demográfico (campos do Form 01 SUS)
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS identidade_genero VARCHAR(50);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS orientacao_sexual VARCHAR(50);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS uf_nascimento VARCHAR(2);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS municipio_nascimento VARCHAR(100);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS situacao_rua BOOLEAN;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS privado_liberdade BOOLEAN;

-- Step 3 — Contato
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS permite_contato BOOLEAN;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS tipo_contato VARCHAR(20);

-- Step 5 — Prescrição (modalidade escolhida pelo paciente)
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS prep_modalidade VARCHAR(30);
