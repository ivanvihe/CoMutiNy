#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
  else
    echo "No se encontró ni 'docker compose' ni 'docker-compose'." >&2
    echo "Instala Docker Compose y vuelve a ejecutar el script." >&2
    exit 1
  fi
else
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
  else
    echo "Docker no está instalado o no se encuentra en el PATH." >&2
    exit 1
  fi
fi

run_compose() {
  "${COMPOSE_CMD[@]}" "$@"
}

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$PROJECT_ROOT"

echo "🔄 Deteniendo servicios y eliminando volúmenes persistentes..."
run_compose down --volumes --remove-orphans

echo "🚀 Reconstruyendo servicios..."
run_compose up --build -d

echo "✅ PostgreSQL se ha reinicializado con las credenciales definidas en tu archivo .env."
echo "ℹ️  Ejecuta '${COMPOSE_CMD[*]} logs -f backend' para seguir los logs del backend si lo necesitas."
