#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MANIFEST_PATH="${1:-${ROOT_DIR}/infrastructure/assets/manifest.json}"
DEST_ROOT="${ASSETS_ROOT:-${ROOT_DIR}/frontend/public/assets}"

if [ ! -f "$MANIFEST_PATH" ]; then
  echo "No se encontró el manifiesto de assets en: $MANIFEST_PATH" >&2
  exit 1
fi

python3 - "$MANIFEST_PATH" "$DEST_ROOT" <<'PY'
import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1]).resolve()
dest_root = Path(sys.argv[2]).resolve()

with manifest_path.open("r", encoding="utf-8") as fh:
    manifest = json.load(fh)

assets = manifest.get("assets", [])
if not isinstance(assets, list):
    raise SystemExit("El manifiesto debe incluir una lista 'assets'.")

missing = []
for asset in assets:
    asset_type = asset.get("type", "file")
    name = asset.get("name", asset.get("url", "(sin nombre)"))
    if asset_type == "zip":
        entries = asset.get("entries", [])
        for entry in entries:
            target_rel = entry.get("target")
            if not target_rel:
                raise SystemExit(f"La entrada en '{name}' carece de 'target'.")
            target_path = dest_root / target_rel
            if not target_path.exists():
                missing.append((name, str(target_rel)))
    else:
        target_rel = asset.get("target")
        if not target_rel:
            raise SystemExit(f"El asset '{name}' carece de 'target'.")
        target_path = dest_root / target_rel
        if not target_path.exists():
            missing.append((name, str(target_rel)))

if missing:
    print("Faltan los siguientes assets descargados:")
    for asset_name, target in missing:
        print(f"  - {asset_name}: {target}")
    print("Ejecuta ./infrastructure/scripts/download-assets.sh para recuperarlos.")
    raise SystemExit(1)

print("Todos los assets requeridos están disponibles en", dest_root)
PY
