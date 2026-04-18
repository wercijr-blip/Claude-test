#!/bin/bash

# ============================================================
# Facilita PrEP — Script de Setup e Teste de Viabilidade
# Para usar com Claude Code
# ============================================================

set -e  # Para na primeira falha

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

step() { echo -e "\n${BLUE}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════╗"
echo "║     Facilita PrEP — Setup & Viabilidade      ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── 1. Pré-requisitos ─────────────────────────────────────

step "Verificando pré-requisitos…"

# Node.js >= 18
if ! command -v node &> /dev/null; then
  fail "Node.js não encontrado. Instale em https://nodejs.org (mínimo v18)"
fi
NODE_VER=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js $NODE_VER muito antigo. Mínimo: v18. Atual: v$NODE_VER"
fi
ok "Node.js v$NODE_VER"

# pnpm (obrigatório — não usar npm/yarn)
if ! command -v pnpm &> /dev/null; then
  warn "pnpm não encontrado. Instalando via npm…"
  npm install -g pnpm@10.4.1
fi
PNPM_VER=$(pnpm -v)
ok "pnpm v$PNPM_VER"

# TypeScript check (opcional)
if command -v tsc &> /dev/null; then
  ok "tsc disponível: $(tsc -v)"
else
  warn "tsc não encontrado globalmente (ok — será usado via pnpm)"
fi

# ─── 2. Variáveis de Ambiente ──────────────────────────────

step "Verificando variáveis de ambiente…"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    warn ".env criado a partir de .env.example — PREENCHA as variáveis antes de rodar!"
  else
    warn ".env não encontrado. Crie o arquivo .env com as variáveis necessárias."
    warn "Veja a seção 'Variáveis de Ambiente' no CLAUDE.md"
  fi
else
  ok ".env encontrado"
fi

# Verificar variáveis críticas (sem exibir valores)
check_env() {
  if grep -q "^$1=" .env 2>/dev/null && [ -n "$(grep "^$1=" .env 2>/dev/null | cut -d= -f2-)" ]; then
    ok "$1 configurado"
  else
    warn "$1 NÃO configurado (necessário para: $2)"
  fi
}

echo ""
echo "Status das variáveis de ambiente:"
check_env "DATABASE_URL"      "banco de dados"
check_env "JWT_SECRET"        "autenticação"
check_env "OAUTH_SERVER_URL"  "login OAuth"
check_env "VITE_APP_ID"       "frontend"
check_env "GMAIL_USER"        "e-mails"
check_env "STRIPE_SECRET_KEY" "pagamentos"

# ─── 3. Instalação de Dependências ────────────────────────

step "Instalando dependências…"
pnpm install --frozen-lockfile
ok "Dependências instaladas"

# ─── 4. Verificação de Tipos TypeScript ───────────────────

step "Verificando tipos TypeScript…"
TS_OUTPUT=$(pnpm check 2>&1) || true
if echo "$TS_OUTPUT" | grep -q "error TS"; then
  warn "Erros de TypeScript encontrados. Rode 'pnpm check' para detalhes."
  echo "$TS_OUTPUT" | grep "error TS" | head -20
else
  ok "Tipos TypeScript: OK"
fi

# ─── 5. Testes Unitários ──────────────────────────────────

step "Rodando testes unitários…"
echo ""

# Testes que NÃO precisam de banco de dados
UNIT_TESTS=(
  "server/security.test.ts"
  "server/roles.test.ts"
  "server/token.test.ts"
)

PASS=0
FAIL=0

for test in "${UNIT_TESTS[@]}"; do
  if [ -f "$test" ]; then
    echo -n "  Testando $test … "
    if pnpm vitest run "$test" --reporter=dot > /dev/null 2>&1; then
      echo -e "${GREEN}PASSOU${NC}"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}FALHOU${NC}"
      FAIL=$((FAIL + 1))
    fi
  else
    warn "  Arquivo não encontrado: $test"
  fi
done

echo ""
echo -e "Resultado: ${GREEN}$PASS passou(aram)${NC} | ${RED}$FAIL falhou(aram)${NC}"

# ─── 6. Verificação de Certificados ICP-Brasil ────────────

step "Verificando certificados ICP-Brasil…"

CERT_DIR="server/certs"
CERTS=("werciley-cert.pem" "werciley-key.pem" "werciley.pfx")

for cert in "${CERTS[@]}"; do
  if [ -f "$CERT_DIR/$cert" ]; then
    ok "$cert presente"
    # Verificar validade do certificado PEM
    if [[ "$cert" == *.pem ]] && command -v openssl &> /dev/null; then
      EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_DIR/$cert" 2>/dev/null | cut -d= -f2)
      if [ -n "$EXPIRY" ]; then
        echo "    Validade: $EXPIRY"
      fi
    fi
  else
    warn "$cert NÃO encontrado em $CERT_DIR/"
    warn "   Necessário para assinatura digital ICP-Brasil"
  fi
done

# ─── 7. Build de Produção (opcional) ──────────────────────

step "Build de produção (verificação)…"
if [[ "${1}" == "--build" ]]; then
  pnpm build && ok "Build concluído com sucesso" || fail "Build falhou"
else
  warn "Build pulado. Use './setup.sh --build' para testar o build completo."
fi

# ─── 8. Resumo Final ──────────────────────────────────────

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗"
echo -e "║             RESUMO DO SETUP                  ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}pnpm dev${NC}        → Servidor de desenvolvimento"
echo -e "  ${GREEN}pnpm test${NC}       → Rodar todos os testes"
echo -e "  ${GREEN}pnpm check${NC}      → Verificar TypeScript"
echo -e "  ${GREEN}pnpm db:push${NC}    → Aplicar schema no banco"
echo -e "  ${GREEN}pnpm build${NC}      → Build de produção"
echo ""

if [ -f ".env" ] && grep -q "DATABASE_URL=mysql://usuario:senha" .env 2>/dev/null; then
  echo -e "  ${YELLOW}⚠  Configure DATABASE_URL no .env antes de 'pnpm dev'${NC}"
fi

echo ""
echo -e "  📖 Leia o CLAUDE.md para detalhes completos da arquitetura."
echo ""
