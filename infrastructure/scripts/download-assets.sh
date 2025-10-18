#!/usr/bin/env bash
set -euo pipefail

ASSETS_FILE="assets.txt"
DOWNLOAD_DIR="${1:-infrastructure/assets}"

if [[ ! -f "$ASSETS_FILE" ]]; then
  echo "No se encontró ${ASSETS_FILE}. Cree el archivo con una URL por línea." >&2
  exit 1
fi

mkdir -p "$DOWNLOAD_DIR"

while IFS= read -r url || [[ -n "$url" ]]; do
  [[ -z "$url" ]] && continue
  echo "Descargando $url"
  curl -fsSL "$url" -o "$DOWNLOAD_DIR/$(basename "$url")"
done < "$ASSETS_FILE"

echo "Descarga completada en $DOWNLOAD_DIR"
