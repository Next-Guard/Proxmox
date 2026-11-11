#!/usr/bin/env bash
# Build del sito Proxmox Community (Astro Starlight).
#
# Uso: tools/build.sh [cartella-di-uscita]
#   - installa le dipendenze se mancano (npm ci);
#   - copia i sorgenti in una cartella di lavoro FUORI dal repository (predefinita:
#     ../nextguard-starlight-work): Astro scrive la sua cartella .astro/ nella radice del progetto
#     e nel repository non devono nascere file o cartelle che iniziano con ".";
#   - genera il sito in una cartella FUORI dal repository (predefinita: ../nextguard-starlight-site);
#     starlight-links-validator ferma il build su link o ancore interne non valide;
#   - verifica il risultato con tools/check-site.mjs (percorsi "_"/".", CNAME, lingue, link interni,
#     indice di ricerca, sintassi MkDocs residua).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(realpath -m "${1:-$REPO/../nextguard-starlight-site}")"
WORK="$(realpath -m "${WORK:-$REPO/../nextguard-starlight-work}")"

case "$OUT/" in "$REPO"/*) echo "La cartella di uscita deve stare fuori dal repository: $OUT" >&2; exit 1 ;; esac
case "$WORK/" in "$REPO"/*) echo "La cartella di lavoro deve stare fuori dal repository: $WORK" >&2; exit 1 ;; esac

export ASTRO_TELEMETRY_DISABLED=1

if [ ! -x "$REPO/node_modules/.bin/astro" ]; then
  (cd "$REPO" && npm ci --no-audit --no-fund)
fi

mkdir -p "$WORK"
rsync -a --delete --exclude /node_modules --exclude /.git --exclude /.astro "$REPO/" "$WORK/"
ln -sfn "$REPO/node_modules" "$WORK/node_modules"

rm -rf "$OUT"
(cd "$WORK" && ./node_modules/.bin/astro build --outDir "$OUT")

# Alias /sitemap.xml: alcuni strumenti (es. Search Console) cercano questo nome.
cp "$OUT/sitemap-index.xml" "$OUT/sitemap.xml"

node "$REPO/tools/check-site.mjs" "$OUT" "$REPO"
echo "Sito generato in: $OUT"
