#!/usr/bin/env bash
# Fetch inputs for build.py: OSM Italia regional extract (Lombardia) + Copernicus GLO-30 tiles.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p cache/dem
curl -fL -o cache/lombardia.osm.pbf https://osmit-estratti.wmcloud.org/output/pbf/regioni/03_Lombardia.osm.pbf
for lat in 44 45 46; do
  for lon in 008 009 010 011; do
    n="Copernicus_DSM_COG_10_N${lat}_00_E${lon}_00_DEM"
    [ -f "cache/dem/$n.tif" ] || curl -fsL -o "cache/dem/$n.tif" "https://copernicus-dem-30m.s3.amazonaws.com/$n/$n.tif" || echo "no tile $n (sea/outside)"
  done
done
