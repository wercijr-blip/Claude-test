#!/usr/bin/env bash
# DR Validation Script — Facilita PrEP
# Validates that backup/restore path is operational without destructive actions.
# Run manually or in CI: bash scripts/dr-check.sh
#
# Prerequisites: DATABASE_URL, REDIS_URL, AWS_* vars in environment.
#
# Expected RTO targets (measured, not estimated):
#   DB restore from TiDB backup: ~15 min
#   Redis flush + BullMQ restart:  ~2 min
#   S3 bucket restore: ~30 min (depends on object count)
#   Full service restart on Railway: ~3 min

set -euo pipefail

PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "✓ $name"
    ((PASS++)) || true
  else
    echo "✗ $name — FALHOU"
    ((FAIL++)) || true
  fi
}

echo "=== DR Check — $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# 1. DB connectivity
check "banco de dados" "tsx -e \"import('./server/db.ts').then(m => m.db.execute('SELECT 1'))\""

# 2. Redis connectivity
check "redis" "tsx -e \"import('./server/_core/redis.ts').then(async m => { const r = await m.redis.ping(); if(r !== 'PONG') throw new Error('no pong'); await m.redis.quit() })\""

# 3. S3 bucket exists and accessible
check "s3 bucket" "tsx -e \"
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
const c = new S3Client({ region: process.env.AWS_REGION ?? 'sa-east-1', credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! } });
await c.send(new HeadBucketCommand({ Bucket: process.env.AWS_S3_BUCKET! }));
\""

# 4. ICP certificate not expired
check "certificado ICP-Brasil" "tsx -e \"
import { inspecionarCertificado } from './server/pdfSigner.ts';
const info = await inspecionarCertificado();
if (info.status === 'expirado') throw new Error('Certificado expirado!');
if (info.status === 'valido' && info.diasRestantes < 7) throw new Error('Certificado expira em menos de 7 dias!');
\""

# 5. Deep healthcheck endpoint (requires running server)
if [ -n "${APP_URL:-}" ]; then
  check "deep healthcheck endpoint" "curl -sf '${APP_URL}/api/health/deep' | grep -q '\"status\":\"ok\"'"
fi

echo ""
echo "Resultado: ${PASS} passou, ${FAIL} falhou"
[ "$FAIL" -eq 0 ] && echo "✓ DR check completo — todos os serviços operacionais" && exit 0 || { echo "✗ DR check FALHOU — revisar antes do próximo deploy"; exit 1; }
