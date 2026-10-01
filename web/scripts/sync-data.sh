#!/usr/bin/env bash
# Copy ETL artifacts into the web app's static dir (local dev / static hosting).
# In production, upload etl/out/{data,tiles} to object storage + CDN instead and set PUBLIC_ASSET_BASE.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$here/../etl/out}"
rm -rf "$here/static/data" "$here/static/tiles"
cp -r "$out/data" "$here/static/data"
cp -r "$out/tiles" "$here/static/tiles"
echo "synced $(ls "$here/static/data/trails" | grep -c json) trails, $(ls "$here/static/data/trailheads" | wc -l) trailheads"
