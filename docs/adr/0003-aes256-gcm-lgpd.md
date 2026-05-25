# ADR 0003 — AES-256-GCM para criptografia de dados sensíveis (LGPD)

**Status:** Aceito  
**Data:** 2025-Q1

## Contexto

LGPD Art. 11 exige tratamento especial de dados de saúde. CPF, nome, email, telefone
e outros dados pessoais precisam de proteção em repouso no banco de dados.

## Decisão

Usar AES-256-GCM (autenticado) via `node:crypto`:

- IV aleatório de 16 bytes por operação → mesmo plaintext gera ciphertexts diferentes
- Tag de autenticação de 16 bytes → detecta adulteração
- Prefixo `v1:` → permite migração transparente de versão de chave
- Chave separada `TOTP_ENC_KEY` para secrets TOTP (compartimentação de risco)
- `cpfHash` via HMAC-SHA256 → busca sem descriptografia

## Consequências

**Positivas:**

- Dados PII nunca armazenados em texto claro
- Adulteração de ciphertexts detectada antes da descriptografia
- Rolling key migration sem downtime (via prefixo de versão)

**Negativas:**

- Busca por CPF requer hash pré-computado (não pode fazer LIKE/contains)
- Descriptografia em loop pode ser lenta para exports grandes
