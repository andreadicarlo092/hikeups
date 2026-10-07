#!/usr/bin/env bash
# Copia i dati del pilota in web/static/data.
# Uso: scripts/sync-data.sh [cartella_out]
# Default: /workspace/media/pilot/out se esiste, altrimenti etl/out.
# Accetta sia il formato dell'ETL del pilota (trailheads.json, th/, trail/)
# sia quello dello schema (trailheads.json, trailheads/, trails/).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="${1:-}"
if [ -z "$src" ]; then
	if [ -d /workspace/media/pilot/out ]; then src=/workspace/media/pilot/out
	else src="$here/../etl/out"; fi
fi
rm -rf "$here/static/data"
mkdir -p "$here/static/data/trailheads" "$here/static/data/trails"
cp "$src/trailheads.json" "$here/static/data/trailheads.json"
[ -f "$src/search.json" ] && cp "$src/search.json" "$here/static/data/search.json"
for pair in "th:trailheads" "trailheads:trailheads" "trail:trails" "trails:trails"; do
	from="${pair%%:*}"
	to="${pair##*:}"
	if [ -d "$src/$from" ]; then cp -r "$src/$from"/. "$here/static/data/$to/"; fi
done
echo "copiati $(ls "$here/static/data/trails" | wc -l) sentieri e $(ls "$here/static/data/trailheads" | wc -l) punti da $src"
