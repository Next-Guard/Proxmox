#!/usr/bin/env bash
# Build del sito Proxmox Community.
#
# Uso: tools/build.sh [cartella-di-uscita]
#   - crea (se manca) un ambiente Python FUORI dal repository: ../venv-proxmox-community
#   - genera il sito in una cartella FUORI dal repository (predefinita: ../nextguard-site)
#   - esegue il build in modalità strict: si ferma su link, immagini o ancore mancanti
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${VENV:-$REPO/../venv-proxmox-community}"
OUT="${1:-$REPO/../nextguard-site}"

if [ ! -x "$VENV/bin/mkdocs" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$REPO/requirements.txt"
fi

cd "$REPO"
"$VENV/bin/mkdocs" build --strict --clean --site-dir "$OUT"

# Verifiche minime sul risultato
test -f "$OUT/index.html"
test -f "$OUT/it/index.html"
test -f "$OUT/CNAME"
grep -q '<html lang="en"' "$OUT/404.html"   # la 404 nella radice è quella inglese
test -f "$OUT/it/404.html"
test -f "$OUT/search/search_index.json"
test -f "$OUT/it/search/search_index.json"
echo "Sito generato in: $OUT"
echo "Pagine HTML: $(find "$OUT" -name index.html | wc -l)"
