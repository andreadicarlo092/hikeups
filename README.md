# Trail Explorer

Open map of hiking trails in **Lombardia**. Pick a trailhead (parking, village, cable car…) and see every CAI/REL trail that leaves from it — difficulty, length, elevation gain/loss, CAI time — then open a trail sheet with the line, elevation profile, GPX and a link back to OpenStreetMap.

Phase 0 of the [architecture v1.1](docs/architecture-v1.1.md): **static files only**. No API, no database in production, no accounts, no cookies, no analytics.

```
etl/   weekly batch (Python): OSM PBF + Copernicus DEM -> JSON + GPX + PMTiles
web/   SvelteKit app (adapter-static): MapLibre map, trailhead panel, prerendered trail pages
```

## Quick start

Requirements: Python 3.10+, Node 22+, `osmium-tool`, `gdal-bin` (for `gdalbuildvrt`), [tippecanoe](https://github.com/felt/tippecanoe) ≥ 2.17 (PMTiles output).

```bash
# 1. ETL (run on a laptop / CI runner, never on the public box)
cd etl
pip install -r requirements.txt
./download.sh                 # ~300 MB OSM extract + ~12 DEM tiles
python build.py               # ~2 min -> etl/out/
# outputs: out/data/{trailheads,trails}/*.json, out/data/trails/*.gpx,
#          out/tiles/{trails,trailheads,huts}.pmtiles,
#          out/trailheads_review.csv, out/etl_run.json

# 2. Web app
cd ../web
npm install
./scripts/sync-data.sh        # copies etl/out into web/static (gitignored)
npm run dev                   # http://localhost:5173
npm run build                 # static site in web/build (prerenders every trail page)
```

## How it works

### ETL (`etl/build.py`)

1. `osmium tags-filter` → hiking relations (`network` ∈ lwn/rwn/nwn/iwn), huts, parking, cable-car stations, bus stops, places.
2. Relation member ways → `linemerge`; fragmented relations are chained end-to-end and **logged** (`etl_run.json → warnings`), never silently dropped. Gaps > 5 km and superroutes are skipped and logged.
3. Difficulty: `cai_scale` → `via_ferrata_scale` → relation `sac_scale` → hardest member-way `sac_scale`. Source recorded as `difficulty_source`.
4. Elevation: Copernicus GLO-30 sampled every 100 m, light smoothing, gain/loss from the profile. CAI time = `km/4 + gain/400`.
5. Trailheads: trail start/end points clustered within 70 m. Published automatically if `trail_count ≥ 2` or within 120 m of parking / cable car / bus stop / village; otherwise written to `trailheads_review.csv`. IDs are the smallest OSM node id in the cluster, so they stay stable across weekly runs.
6. tippecanoe → `trails.pmtiles` (z5–14), `trailheads.pmtiles` (pre-clustered up to z12), `huts.pmtiles`.

Trail ids are OSM relation ids → `/trails/{osm_relation_id}` URLs are stable and shareable.

### Trailhead review (CAI partner workflow)

Hand `out/trailheads_review.csv` to the partner section. To publish, hide or rename a trailhead:

```bash
python publish_trailhead.py 3756060031 --name "Parcheggio Ca' del Monte" --note "CAI Lecco"
python publish_trailhead.py 2205292380 --hide
```

This writes `etl/trailheads_overrides.csv` (committed), applied on every ETL run.

### Web (`web/`)

- `/` — MapLibre map, GPU layers only (no DOM markers). Cluster click zooms; trailhead click opens the panel (bottom sheet on mobile, side panel on desktop). `/?th={id}` deep-links a trailhead.
- `/trails/{id}` — prerendered trail sheet (title + OG meta for sharing), map, Chart.js elevation profile, GPX, Open in OSM, Share.
- Panel sort: T → E → EE → EEA, then length.
- PWA: manifest + service worker (app shell cached; trail pages/data network-first with offline fallback).

Config (`web/.env`, see `.env.example`): `PUBLIC_STYLE_URL`, `PUBLIC_FALLBACK_STYLE_URL`, `PUBLIC_ASSET_BASE` (CDN origin for `/data` + `/tiles`).

## Deploying (≈ €0–10/month)

- **GitHub Pages (default):** `.github/workflows/deploy.yml` runs the full weekly job on a GitHub runner (on push to `main`, every Monday 03:00 UTC, or manually) and publishes `web/build/` to `https://<owner>.github.io/<repo>/`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
- The app can live under a sub-path: set `BASE_PATH=/<repo>` at build time (empty for a root domain).
- `web/build/` is a plain static site → any other static host works too (Netlify, an object-storage bucket + CDN, or Caddy on a small VPS). Cloudflare Pages' 20k-file limit is too small for the ~21k files.
- The host must support HTTP **Range** requests for `.pmtiles` (all of the above do).
- Data changes weekly: `Cache-Control: public, max-age=86400` on `/data` and `/tiles`.
- Prerendering every trail page needs the data at build time, so the weekly job is: `download.sh → build.py → sync-data.sh → npm run build → upload`.

## Licences

- Code: **AGPL-3.0** (see `LICENSE`).
- Trail data: © OpenStreetMap contributors, **ODbL** — attribution shown on the map and every trail page/GPX.
- Elevation: Copernicus GLO-30 (© DLR/Airbus, provided under COPERNICUS by the European Union and ESA).
- Basemap: OpenFreeMap (OpenMapTiles schema, © OSM). JS deps: MapLibre GL (BSD-3), pmtiles (BSD-3), Chart.js (MIT).
- Not used: Regione Lombardia DTM 5 m (CC-BY-NC-SA), REL catasto (licence review pending).
