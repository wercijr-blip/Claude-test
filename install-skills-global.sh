#!/usr/bin/env bash
# Instala as skills deste projeto em ~/.claude/commands/ (global)
# Uso: bash install-skills-global.sh

set -euo pipefail

SRC="$(cd "$(dirname "$0")/.claude/commands" && pwd)"
DEST="$HOME/.claude/commands"
SKIP=0
COPIED=0
CONFLICT=0

if [ ! -d "$SRC" ]; then
  echo "Erro: pasta .claude/commands/ não encontrada. Rode este script a partir da raiz do repositório."
  exit 1
fi

mkdir -p "$DEST"

for src_file in "$SRC"/*.md; do
  [ -f "$src_file" ] || continue
  filename="$(basename "$src_file")"
  dest_file="$DEST/$filename"

  if [ -f "$dest_file" ]; then
    # Arquivo já existe globalmente — pula para não sobrescrever customizações
    CONFLICT=$((CONFLICT + 1))
  else
    cp "$src_file" "$dest_file"
    COPIED=$((COPIED + 1))
  fi
done

TOTAL=$(find "$SRC" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')

echo ""
echo "✅ Instalação global concluída"
echo "   Total de skills no projeto : $TOTAL"
echo "   Copiadas para ~/.claude    : $COPIED"
echo "   Já existiam (não alteradas): $CONFLICT"
echo ""
echo "As skills estão disponíveis em todos os projetos no Claude Code."
echo "Para atualizar skills que já existiam, rode com a flag --force:"
echo "  bash install-skills-global.sh --force"
echo ""

# Modo --force: sobrescreve tudo
if [[ "${1:-}" == "--force" ]]; then
  for src_file in "$SRC"/*.md; do
    [ -f "$src_file" ] || continue
    cp "$src_file" "$DEST/$(basename "$src_file")"
  done
  echo "✅ Modo --force: todas as $TOTAL skills foram sobrescritas."
fi
