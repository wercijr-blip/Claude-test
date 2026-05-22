#!/usr/bin/env bash
# Pre-deploy: aplica migrations pendentes antes de subir a nova versão.
# Configurar no Railway: Settings → Build → Build Command:
#   bash scripts/pre-deploy.sh && pnpm build
#
# Saída de erro aborta o deploy automaticamente (exit code != 0).
set -euo pipefail

echo "▶ [pre-deploy] Verificando migrations pendentes…"

if ! pnpm drizzle-kit migrate --config drizzle.config.ts 2>&1; then
  echo "✖ [pre-deploy] Migration falhou — deploy abortado."
  exit 1
fi

echo "✔ [pre-deploy] Migrations aplicadas com sucesso."
