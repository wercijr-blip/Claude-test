-- Migration: adicionar campos SUS + nome da mãe + modalidade PrEP à tabela pacientes
-- Aplicar via: pnpm db:push  (ou rodar manualmente no MySQL/TiDB)
-- Idempotente: usa IF NOT EXISTS quando suportado.

ALTER TABLE pacientes ADD COLUMN nome_mae_encrypted TEXT;
ALTER TABLE pacientes ADD COLUMN cns VARCHAR(20);
ALTER TABLE pacientes ADD COLUMN identidade_genero VARCHAR(50);
ALTER TABLE pacientes ADD COLUMN orientacao_sexual VARCHAR(50);
ALTER TABLE pacientes ADD COLUMN uf_nascimento VARCHAR(2);
ALTER TABLE pacientes ADD COLUMN municipio_nascimento VARCHAR(100);
ALTER TABLE pacientes ADD COLUMN situacao_rua BOOLEAN;
ALTER TABLE pacientes ADD COLUMN privado_liberdade BOOLEAN;
ALTER TABLE pacientes ADD COLUMN permite_contato BOOLEAN;
ALTER TABLE pacientes ADD COLUMN tipo_contato VARCHAR(20);
ALTER TABLE pacientes ADD COLUMN prep_modalidade VARCHAR(30);
