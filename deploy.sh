#!/bin/bash
# ─── deploy.sh — commit + push + deploy Render com logs ao vivo ───────────────
# Uso: ./deploy.sh "mensagem do commit"
# Ou:  ./deploy.sh              (usa mensagem automática com data/hora)

set -e

# ── Carrega .env da raiz do projeto ───────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
else
  echo -e "\033[0;31m✗ ERRO:\033[0m Arquivo .env não encontrado em $SCRIPT_DIR"
  echo "  Crie o arquivo .env com:"
  echo "    RENDER_API_KEY=rnd_XXXXXXXXXXXXXXXX"
  echo "    RENDER_SERVICE_ID=srv-XXXXXXXXXXXXXXXX"
  exit 1
fi

# ── Cores ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[deploy]${RESET} $1"; }
ok()   { echo -e "${GREEN}✓${RESET} $1"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $1"; }
err()  { echo -e "${RED}✗ ERRO:${RESET} $1"; exit 1; }

# ── Valida configuração ───────────────────────────────────────────────────────
[ -z "$RENDER_API_KEY" ]     && err "RENDER_API_KEY não encontrada no .env"
[ -z "$RENDER_SERVICE_ID" ]  && err "RENDER_SERVICE_ID não encontrada no .env"

# ── Mensagem do commit ────────────────────────────────────────────────────────
COMMIT_MSG="${1:-deploy $(date '+%d/%m/%Y %H:%M')}"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  DecifrAI — Deploy Script${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── 1. Git ────────────────────────────────────────────────────────────────────
log "Verificando alterações..."
if git diff --quiet && git diff --cached --quiet; then
  warn "Nenhuma alteração detectada no git."
  warn "Forçando deploy sem novo commit..."
else
  log "Adicionando arquivos..."
  git add -A
  ok "git add -A"

  log "Fazendo commit: \"$COMMIT_MSG\""
  git commit -m "$COMMIT_MSG"
  ok "Commit criado"

  log "Fazendo push..."
  git push
  ok "Push concluído"
fi

echo ""

# ── 2. Trigger deploy no Render ───────────────────────────────────────────────
log "Disparando deploy no Render..."

DEPLOY_RESPONSE=$(curl -s -X POST \
  "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json")

DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$DEPLOY_ID" ]; then
  echo "Resposta do Render: $DEPLOY_RESPONSE"
  err "Não foi possível obter o ID do deploy. Verifique RENDER_API_KEY e RENDER_SERVICE_ID."
fi

ok "Deploy iniciado — ID: $DEPLOY_ID"
echo ""

# ── 3. Acompanha status em tempo real ─────────────────────────────────────────
log "Acompanhando deploy (ctrl+C para sair sem cancelar)..."
echo ""

PREV_STATUS=""
ELAPSED=0
INTERVAL=5

while true; do
  DEPLOY_INFO=$(curl -s \
    "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys/${DEPLOY_ID}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}")

  STATUS=$(echo "$DEPLOY_INFO" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ "$STATUS" != "$PREV_STATUS" ]; then
    case "$STATUS" in
      "created")             echo -e "  ${YELLOW}●${RESET} Criado — aguardando worker..." ;;
      "build_in_progress")   echo -e "  ${YELLOW}●${RESET} Buildando..." ;;
      "update_in_progress")  echo -e "  ${YELLOW}●${RESET} Atualizando serviço..." ;;
      "live")                echo -e "  ${GREEN}●${RESET} ${BOLD}Live!${RESET}" ;;
      "deactivated")         echo -e "  ${YELLOW}●${RESET} Deploy anterior substituído" ;;
      "canceled")            err "Deploy cancelado." ;;
      "failed")
        echo -e "  ${RED}●${RESET} ${BOLD}FALHOU!${RESET}"
        warn "Logs: https://dashboard.render.com/web/${RENDER_SERVICE_ID}/logs"
        exit 1 ;;
      *) echo -e "  ${CYAN}●${RESET} $STATUS" ;;
    esac
    PREV_STATUS="$STATUS"
  else
    printf "."
  fi

  if [ "$STATUS" = "live" ]; then
    echo ""
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    ok "${BOLD}Deploy finalizado!${RESET}"
    echo -e "  Commit: \"$COMMIT_MSG\""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    exit 0
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  [ $ELAPSED -ge 600 ] && warn "Timeout de 10min. Verifique o Render." && exit 1
done