#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_MANIFEST="${ROOT_DIR}/infrastructure/assets/manifest.json"
DEFAULT_DEST="${ROOT_DIR}/frontend/public/assets"

MANIFEST_PATH="$DEFAULT_MANIFEST"
DEST_ROOT="$DEFAULT_DEST"
FORCE_DOWNLOAD=0

usage() {
  cat <<'USAGE'
Uso: download-assets.sh [opciones]

Descarga y extrae los recursos definidos en el manifiesto de assets.

Opciones:
  --manifest <ruta>   Ruta al manifiesto JSON de assets (por defecto infrastructure/assets/manifest.json)
  --dest <ruta>       Directorio raíz donde ubicar los assets (por defecto frontend/public/assets)
  --force             Fuerza la descarga incluso si los archivos destino ya existen
  -h, --help          Muestra esta ayuda
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      [[ $# -lt 2 ]] && { echo "Falta el valor para --manifest" >&2; exit 1; }
      MANIFEST_PATH="$2"
      shift 2
      ;;
    --dest)
      [[ $# -lt 2 ]] && { echo "Falta el valor para --dest" >&2; exit 1; }
      DEST_ROOT="$2"
      shift 2
      ;;
    --force)
      FORCE_DOWNLOAD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opción desconocida: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "No se encontró el manifiesto de assets en: $MANIFEST_PATH" >&2
  exit 1
fi

mkdir -p "$DEST_ROOT"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

FORCE_DOWNLOAD=$FORCE_DOWNLOAD python3 - "$MANIFEST_PATH" "$DEST_ROOT" "$TEMP_DIR" <<'PY'
import json
import os
import shutil
import sys
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError, HTTPError
import zipfile

manifest_path = Path(sys.argv[1]).resolve()
dest_root = Path(sys.argv[2]).resolve()
temp_root = Path(sys.argv[3]).resolve()
force_download = os.environ.get("FORCE_DOWNLOAD", "0") == "1"

with manifest_path.open("r", encoding="utf-8") as fh:
    manifest = json.load(fh)

assets = manifest.get("assets", [])
if not isinstance(assets, list):
    raise SystemExit("El manifiesto debe incluir una lista 'assets'.")

for asset in assets:
    name = asset.get("name", asset.get("url", "(sin nombre)"))
    asset_type = asset.get("type", "file")
    url = asset.get("url")
    if not url:
        raise SystemExit(f"El asset '{name}' no define la clave 'url'.")

    print(f"Procesando: {name}")

    if asset_type not in {"file", "zip"}:
        raise SystemExit(f"Tipo de asset no soportado: {asset_type}")

    if asset_type == "file":
        target_rel = asset.get("target")
        if not target_rel:
            raise SystemExit(f"El asset '{name}' debe definir 'target'.")
        target_path = dest_root / target_rel
        if target_path.exists() and not force_download:
            print(f"  - Archivo existente, se omite: {target_rel}")
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with urlopen(url) as response, target_path.open("wb") as dst:
                shutil.copyfileobj(response, dst)
        except HTTPError as exc:
            raise SystemExit(f"  - Error HTTP {exc.code} al descargar {url}") from exc
        except URLError as exc:
            raise SystemExit(f"  - Error de red al descargar {url}: {exc.reason}") from exc

        print(f"  - Descargado en {target_rel}")
        continue

    # ZIP asset
    entries = asset.get("entries")
    if not entries:
        raise SystemExit(f"El asset '{name}' debe definir 'entries' para extracción ZIP.")
    strip_components = int(asset.get("strip_components", 0))

    # Determine whether all targets already exist
    all_targets_exist = all((dest_root / entry["target"]).exists() for entry in entries)
    if all_targets_exist and not force_download:
        print("  - Todos los archivos destino ya existen, se omite descarga")
        continue

    temp_zip_path = temp_root / f"asset_{len(os.listdir(temp_root))}.zip"
    try:
        with urlopen(url) as response, temp_zip_path.open("wb") as dst:
            shutil.copyfileobj(response, dst)
    except HTTPError as exc:
        raise SystemExit(f"  - Error HTTP {exc.code} al descargar {url}") from exc
    except URLError as exc:
        raise SystemExit(f"  - Error de red al descargar {url}: {exc.reason}") from exc

    with zipfile.ZipFile(temp_zip_path, "r") as zf:
        members = {
            "/".join(Path(name).parts[strip_components:]): name
            for name in zf.namelist()
            if not name.endswith("/")
        }
        for entry in entries:
            source_rel = entry.get("source")
            target_rel = entry.get("target")
            if not source_rel or not target_rel:
                raise SystemExit(f"  - Cada entrada debe definir 'source' y 'target' (asset '{name}')")

            if source_rel not in members:
                raise SystemExit(
                    f"  - No se encontró '{source_rel}' dentro del ZIP de '{name}'."
                )

            target_path = dest_root / target_rel
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(members[source_rel]) as src, target_path.open("wb") as dst:
                shutil.copyfileobj(src, dst)
            print(f"  - Extraído {source_rel} -> {target_rel}")

    try:
        temp_zip_path.unlink()
    except FileNotFoundError:
        pass

print("Descarga de assets completada.")
PY
