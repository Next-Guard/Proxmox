#!/usr/bin/env bash
# Anteprima con ricaricamento automatico (astro dev).
#
# Uso: tools/dev.sh [opzioni di astro dev, es. --host]
# Come tools/build.sh lavora su una copia dei sorgenti FUORI dal repository (predefinita:
# ../nextguard-starlight-work), così la cartella .astro/ di Astro non nasce nel repository;
# ogni secondo la copia viene riallineata ai file modificati.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(realpath -m "${WORK:-$REPO/../nextguard-starlight-work}")"
case "$WORK/" in "$REPO"/*) echo "La cartella di lavoro deve stare fuori dal repository: $WORK" >&2; exit 1 ;; esac

export ASTRO_TELEMETRY_DISABLED=1
[ -x "$REPO/node_modules/.bin/astro" ] || (cd "$REPO" && npm ci --no-audit --no-fund)

sync() { rsync -a --delete --exclude /node_modules --exclude /.git --exclude /.astro "$REPO/" "$WORK/"; }
mkdir -p "$WORK"
sync
ln -sfn "$REPO/node_modules" "$WORK/node_modules"

( while sleep 1; do sync; done ) &
SYNC_PID=$!
trap 'kill "$SYNC_PID" 2>/dev/null' EXIT

cd "$WORK"
./node_modules/.bin/astro dev "$@"
