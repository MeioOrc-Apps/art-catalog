#!/usr/bin/env bash
set -euo pipefail

echo "=== Fase 0 Smoke Test ==="

echo "[1/4] Subindo serviços..."
docker compose up -d --build --wait

echo "[2/4] Aguardando API ficar pronta..."
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    echo "  API pronta!"
    break
  fi
  sleep 1
done

echo "[3/4] Validando /api/health..."
RESPONSE=$(curl -fsS http://127.0.0.1:8000/api/health)
echo "  Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"status":"ok"'; then
  echo "  ✓ status ok"
else
  echo "  ✗ status falhou"
  exit 1
fi

if echo "$RESPONSE" | grep -q '"app":"Atelier"'; then
  echo "  ✓ app = Atelier"
else
  echo "  ✗ app falhou"
  exit 1
fi

echo "[4/4] Derrubando serviços..."
docker compose down

echo ""
echo "✓ Smoke test passou!"
