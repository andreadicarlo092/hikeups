```markdown
# Trail Explorer — One-pager & Phased Architecture

> **Version:** 1.1 — October 2026
> **Replaces:** Tech Spec v1.0 (September 2026)
> **License:** AGPL-3.0
> **Geography (v0):** Regione Lombardia
> **Audience:** builders, CAI sections, volunteer maintainers

This document is the product + engineering contract. The v1.0 spec remains a useful appendix for OSM tagging, SQL sketches, and MapLibre layer examples. **This file wins on scope, stack, and order of work.**

---

## 1. One-pager

**Trail Explorer** is an open map of hiking trails in Lombardia. You pick a starting point (a *trailhead*: parking, village square, cable-car, signed junction). You get every CAI / REL path that leaves from there — name, difficulty, length, elevation, estimated time — then a trail page with the line, an elevation profile, GPX, and a link back to OSM.

**Vision (later):** a commons for Italian hikers — data first, community second, no paywall, no ads.

**v0 promise (this is the market test):**
a Milano/Bergamo/Lecco hiker can, on a phone, answer *“what starts from that parking lot?”* for Lombardia in under 3 seconds, and send the trail link to a friend.

| | |
|---|---|
| **Who** | Weekend hikers, 25–55, 2–4 trips/year. Secondary: CAI section organisers (as data partners, not as users of software we have not built). |
| **Not who (yet)** | GPS navigators, trace-recorders, social-network users. Komoot/Wikiloc/Organic Maps already own turn-by-turn. |
| **Money** | €0 revenue. Infra target **< €15/month** for v0, **< €30/month** after Italy. |
| **License** | AGPL-3.0 for code. Map data: OSM **ODbL**. Do not ingest datasets whose licence cannot be shipped in a public AGPL app (see §7). |
| **Success (v0)** | People open trailheads, open a trail page, export GPX or share the URL. If that does not happen in Lombardia, do not scale geography or add accounts. |

### In v0

- Interactive map (MapLibre), GPU layers only, clustered trailhead pins.
- Click trailhead → list of trails (difficulty, km, +/- m, CAI time).
- Trail page: line on map, elevation chart, start/end, GPX, “Open in OSM”.
- Optional hut dots (name + position, no hut page).
- PWA, mobile-first, WCAG 2.1 AA contrast, no cookie banner, no analytics.

### Out of v0 (explicit)

Accounts, ratings, photos, planned outings, Telegram, meteo, native apps, turn-by-turn, national coverage, hut detail sheets, 8-dimension filters, Redis, tile servers, FastAPI, Kubernetes.

### Non-negotiables (all phases)

1. **Zero DOM markers** on the map. Native `circle` / `symbol` / `line` layers only.
2. **Zero elevation math on the request path.** Profiles are files produced by ETL.
3. **ETL is a batch job**, never an HTTP handler, never on the public box if it can be avoided.
4. **PMTiles for map overlays.** No `pg_tileserv` until tiles must be live-edited.
5. **No personal data in v0–v1.** No login, no non-essential cookies, no third-party analytics.
6. **AGPL-3.0.** Check every new dependency.
7. **Trailheads that look wrong can be hidden; the map must not wait on a full human census.** Auto-publish high-confidence points; queue the rest for a CAI partner.

---

## 2. Why Lombardia (not “Nord Italia”, not Piemonte)

Lombardia is the densest weekend-hiking market in Italy (Milano + Bergamo + Lecco + Como) and it has **local open-data infrastructure** the national OSM-only plan ignored:

| Asset | Why it matters |
|---|---|
| **REL (Rete Escursionistica Lombarda)** | Official catasto, ~15 000 km, ERSAF + CAI + mountain guides. Inventory to *cross-check* OSM, not a silent replacement. |
| **CAI sections** | Milano, Lecco, Bergamo, Como, Brescia — real design partners for trailhead names. |
| **Terrain** | Grigne, Resegone, Orobie, Adamello (east), Lario, Val Camonica, Garda bresciano — one region, many trip types (T → EEA). |
| **Extracts** | No Geofabrik “Lombardia” file. Clip `nord-ovest` or use **OSM Italia estratti** regional PBF. Boundary: `ISO3166-2=IT-25`. |

**Design partner (pick one, not five):** CAI Lecco *or* CAI Bergamo. They name trailheads, flag broken relations, and send the first 50 users.

REL and the regional DTM are **licence-gated** (see §7). v0 ships on OSM + Copernicus. REL is a QA overlay, not a hard dependency.

---

## 3. Architecture in one picture

v0 has **two machines in spirit**, even if one of them is a laptop:

```text
                    WEEKLY BATCH (not public)
  Geofabrik / OSM Italia PBF
          │  osmium filter route=hiking + clip IT-25
          ▼
  geometries + trailheads + elevation JSON + GPX
          │  tippecanoe
          ▼
  artifacts:  *.pmtiles  +  /data/trailheads/*.json  +  /data/trails/*.json
          │
          └────────────── upload ──────────────┐
                                               ▼
                    PUBLIC SURFACE (cheap, boring)
         CDN / object storage          one web app
         trailheads.pmtiles            MapLibre + pages
         trails.pmtiles                reads JSON from same origin or CDN
         /data/*.json                  no Python API
         OpenFreeMap basemap           no PostGIS on this box
```

**Hot path = static files.** The database, if it exists, lives only inside the batch job.

When a real API becomes necessary (bbox search beyond tiles, Italy-wide, or community writes), add a **thin read layer in the same language as the web app**. Not a second stack. FastAPI is allowed later as a choice, never as a requirement.

---

## 4. Phased architecture

### Phase 0 — Lombardia, static  *(ship this)*

**Duration:** weeks, not a quarter.
**Question it answers:** do people use “trails from this trailhead”?

| Piece | Choice |
|---|---|
| Geography | Regione Lombardia only |
| Serving | One web app (SSR for trail pages, client map). Static JSON + PMTiles. |
| API | **None.** Trailhead click reads `/data/trailheads/{id}.json`. Trail page reads `/data/trails/{id}.json`. |
| Database | Optional, **ETL-only** (PostGIS or even GeoPackage/SQLite during the job). Not deployed to production. |
| Basemap | OpenFreeMap public style. Second style URL in config as fallback. |
| Overlays | `trailheads.pmtiles`, `trails.pmtiles`, optional `huts.pmtiles` |
| Elevation | Precomputed in the trail JSON. Chart.js on the trail page. |
| Trailheads | Auto-cluster start/end points (~50–80 m). Publish if `trail_count ≥ 2` **or** snapped to OSM parking/cable-car/bus_stop. Others stay in a review list (CSV is enough). |
| Auth | Off |
| Hosting | Object storage + CDN for tiles/JSON. Web app on a single small VPS **or** static hosting. Caddy if you need TLS on a VPS. |
| Cost | typically **€0–10 / month** |

**Frontend pages**

```text
/                     map
/trailheads/{id}      panel (can be a map overlay, not a separate URL)
/trails/{id}          SSR trail sheet (title, description, OG text for sharing)
```

Framework is **not binding**. Prefer one runtime volunteers already know. SvelteKit is fine; so is any SSR-capable app. Two runtimes (Node + Python in production) are not fine.

**Map rules (Phase 0)**

- MapLibre GL JS, `pmtiles` protocol.
- Trailheads: `circle` layer, native clustering (`cluster: true` or pre-clustered in tippecanoe).
- Trails: `line` layer, colour by `difficulty`. Clicking a row in the panel sets a filter / highlight layer — still a GPU line, never a marker.
- No `new maplibregl.Marker()`.

**CAI duration (stored, not computed in the browser except as fallback)**

```text
hours = length_km / 4  +  elevation_gain_m / 400
```

**Default sort in the panel:** difficulty T → E → EE → EEA, then length ascending.

### Phase 1 — Same product, operable  *(after people use Phase 0)*

Still no accounts. Still Lombardia, unless a second region is demanded by a partner.

- Weekly scheduled ETL (container or CI cron). Log runs and geometry failures. **Do not delete bad OSM relations; log them.**
- Optional **tiny read API**, five GETs, same app process or a Worker in front of the same files:

  ```text
  GET /api/v1/trailheads?bbox=w,s,e,n
  GET /api/v1/trailheads/{id}/trails
  GET /api/v1/trails/{id}
  GET /api/v1/trails/{id}/elevation
  GET /api/v1/trails/{id}/gpx
  ```

  If JSON files are still small, skip the API. GPX can also stay a static file from ETL (`/data/trails/{id}.gpx`).
- Edge cache (`Cache-Control`) on every GET. Trail data changes weekly.
- LOD in the PMTiles (tippecanoe simplification). PostGIS `ST_SimplifyPreserveTopology` only if you already have PostGIS in the ETL job.
- Lighthouse pass: FCP map < 3 s on mid-range 4G.
- Public GitHub, `README`, `CONTRIBUTING`, bilingual notes (IT + EN).
- Backup of the generated artifact bundle (pmtiles + JSON), not of a production database you do not have.

**Still out:** Redis, `pg_tileserv`, user tables, photos.

### Phase 2 — Community layer  *(only if Phase 1 has retention)*

This is a **new bounded context**. The map stack does not change.

- Magic-link auth. No passwords. Minimum PII (email hash). GDPR: deletion endpoint, no sale of data.
- Planned outings attached to a trail or trailhead (date, meeting point, capacity, public/unlisted link).
- Distinct map layer for future outings (still GPU symbols, not DOM markers).
- Optional Telegram alerts later.

Do not preview this schema in Phase 0 migrations. Do keep the **map API read-only** so the community service cannot take the tiles down.

### Phase 3 — Italy, then i18n

- Next regions by demand (Veneto, Trentino, Piemonte…), same pipeline, new clip polygon.
- National coverage. DE/FR/EN for border valleys.
- Public read API for CAI sections only when they ask.

---

## 5. Data: what we actually import

### OSM (source of truth for v0)

Keep relations matching:

```text
relation[route=hiking][network~"^(lwn|rwn|nwn|iwn)$"]
```

Clip to Lombardia. Prefer `operator=Club Alpino Italiano` / REL tags as a **boost**, not a hard filter — tagging is inconsistent.

| OSM | Field | Notes |
|---|---|---|
| `ref` | `cai_ref` | Often the number; sometimes stuffed into `name` — normalise. |
| `cai_scale` | `difficulty` | T / E / EE / EEA. If missing, map `sac_scale` as a fallback and flag `difficulty_source`. |
| `network` | `network` | lwn / rwn / nwn / iwn |
| `name` | `name` | Human title |
| `osmc:symbol`, `roundtrip`, `via_ferrata_scale` | `tags` | JSON extras: Circolare, Ferrata, famiglie when you can derive them |
| relation id | `osm_id`, `osm_url` | `https://www.openstreetmap.org/relation/{id}` |
| geometry | `geom` | `ST_LineMerge` / equivalent; log empty/broken, do not silent-drop |
| — | `length_km` | From geometry if tag absent |
| — | `elevation_profile` | `[{d_km, alt_m}, ...]` ~100 m sampling |
| — | `elevation_gain_m` / `_loss_m` | From the profile |
| — | `duration_hours` | CAI formula above |

**Huts (optional layer):** OSM `tourism=alpine_hut` or `amenity=shelter` inside Lombardia. Name + point only.

### Trailheads (generated)

1. Collect start and end of every published trail.
2. Cluster (~50–80 m; `0.0005°` is a starting epsilon in this latitude).
3. Centroid = draft trailhead.
4. **Publish automatically** if `trail_count ≥ 2` or the centroid snaps to a useful OSM node (parking, `aerialway=station`, `highway=bus_stop`, `place=hamlet/village`).
5. Name from the snapped OSM object; else “Trailhead near {closest named place}”.
6. Remainder → `trailheads_review.csv` for the partner. A CLI that sets `published=true` is enough. No admin SPA in v0.

### Elevation

**Default:** Copernicus GLO-30 (open). Sample during ETL, write JSON, throw the raster away.

**Not default:** Regione Lombardia DTM 5 m. Higher quality, but the commonly cited licence is **CC-BY-NC-SA** — incompatible with a public AGPL product that anyone may commercially host. Revisit only with a written licence check.

### REL catasto

Use as a **diff tool** in ETL logs (“OSM relation X has no REL twin”, “REL path Y missing on OSM”). Import as geometries only after licence review. OSM remains what we display, so contributors can fix it upstream.

### Batch schedule

Weekly is enough. Order: download extract → clip Lombardia → filter hiking → rebuild lines → profiles → trailheads → tippecanoe → upload artifacts → write `etl_run.json`.

Run this on a short-lived fat machine or a CI runner with disk. **Do not run it on the public VPS.**

---

## 6. Serving & scale

| Load | What you run |
|---|---|
| v0, hundreds of users | PMTiles + JSON on a CDN. One web app. |
| A spike (press, CAI newsletter) | Same. Edge cache. The map does not hit a database. |
| Italy-wide read traffic | Same tiles pattern, more files. Optional bbox API in the web app, still cached. |
| Community writes | Separate service + Postgres. Map files unchanged. |

**Scale lever is CDN caching, not Redis.** All trail payloads are immutable between weekly ETL runs.

**bbox rules** (when an API exists): required WGS84, reject inverted / huge envelopes (cap ~1°), `limit` default 500.

**GPX:** prefer static files from ETL. If generated on the fly, rate-limit; it is the only CPU-heavy read.

**OpenFreeMap:** free public instance, no SLA. Keep `FALLBACK_STYLE_URL` (e.g. a Protomaps/self-hosted style). Do not self-host a planet basemap in v0.

---

## 7. Security, privacy, licences

v0 security is **having almost nothing to steal**.

- Read-only public surface. No user writes, no sessions.
- Object storage is public for tiles/JSON (they are open data). The ETL credentials are not.
- If a VPS exists: no Postgres port on the internet; SSH keys; automatic updates.
- CORS allowlist the real origin if you add an API.
- Access logs: short retention. They are personal data even if the app has no accounts.
- No third-party scripts that set cookies (analytics, tag managers, most “free” chat widgets).

**Licences to keep straight**

| Source | Licence | v0 use |
|---|---|---|
| Code | AGPL-3.0 | yes |
| OSM | ODbL | yes — attribute, share-alike on the database |
| OpenFreeMap / MapLibre | permissive | yes |
| Copernicus GLO-30 | open (EU) | yes for profiles |
| REL catasto / shapefiles | check per dataset | QA only until cleared |
| DTM 5 m RL | often CC-BY-NC-SA | **not** in the public pipeline |

AGPL means a hosted fork must release its source. That is intentional. It is a poor fit if you later want a closed SaaS. Decide that now.

---

## 8. Minimal data shapes

Static JSON is the contract. Postgres, if used in ETL, must be able to dump these 1:1.

**`/data/trailheads/{id}.json`**

```json
{
  "id": 12,
  "name": "Piani Resinelli",
  "lng": 9.396,
  "lat": 45.910,
  "trail_count": 6,
  "trails": [
    {
      "id": 401,
      "name": "Sentiero 1 — Rifugio Brioschi",
      "cai_ref": "1",
      "difficulty": "EE",
      "length_km": 12.4,
      "elevation_gain_m": 1400,
      "elevation_loss_m": 210,
      "duration_hours": 6.6,
      "tags": ["ferrata"]
    }
  ]
}
```

**`/data/trails/{id}.json`**

```json
{
  "id": 401,
  "osm_id": 123456,
  "osm_url": "https://www.openstreetmap.org/relation/123456",
  "name": "Sentiero 1 — Rifugio Brioschi",
  "cai_ref": "1",
  "difficulty": "EE",
  "network": "lwn",
  "length_km": 12.4,
  "elevation_gain_m": 1400,
  "elevation_loss_m": 210,
  "duration_hours": 6.6,
  "tags": ["ferrata"],
  "start": { "lng": 9.396, "lat": 45.910 },
  "end": { "lng": 9.388, "lat": 45.961 },
  "geometry": { "type": "LineString", "coordinates": [] },
  "elevation_profile": [{ "d_km": 0, "alt_m": 1280 }],
  "gpx_url": "/data/trails/401.gpx"
}
```

Trailhead PMTiles properties: `id`, `name`, `trail_count`. Trail PMTiles properties: `id`, `difficulty`, `cai_ref` (geometry in the tile; full line lives in the JSON for the sheet).

---

## 9. UX (unchanged in spirit, cheaper in implementation)

- Mobile-first, 375 px+. Map ~80% of the viewport. Panel is a bottom sheet on small screens, side panel on desktop.
- Cluster click = zoom, never a sheet.
- Trail click in the list = highlight the line + link to the sheet.
- No popups, no banners, no push.
- Keyboard: panel list, trail sheet, GPX/OSM links.
- Shareable trail URL is the v0 “social feature”.

---

## 10. Suggested build order (Phase 0)

Do not start with Docker Compose of five services.

1. Clip Lombardia hiking relations from a PBF; dump GeoJSON.
2. Generate trailheads; publish the obvious ones; write the JSON contract in §8.
3. Sample elevation (Copernicus); write profiles; compute gain/loss/duration.
4. `tippecanoe` → two PMTiles; put them on any static host.
5. Web app: map + GPU layers + trailhead sheet + trail page + Chart.js + GPX link.
6. PWA manifest. Contrast pass. Mobile bottom sheet.
7. Hand the review CSV to one CAI section. Ship the rest.

Phase 1 starts when step 7 has real feedback, not when the schema is “complete”.

---

## 11. What changed vs spec v1.0

| v1.0 | v1.1 |
|---|---|
| Nord Italia, Piemonte as pilot | **Lombardia only** until the product is used |
| FastAPI + SvelteKit + PostGIS + nginx + ETL as production Compose | **Static JSON + PMTiles + one web app.** PostGIS optional in the batch job |
| Human validation gate on every trailhead | Auto-publish high-confidence; CSV for the rest |
| Copernicus raster in production PostGIS | Sample in ETL, store JSON, discard raster |
| Five production services | Two artifact types (tiles, JSON) and one app |
| Community sketched as Phase 2 of the same monolith | Separate bounded context, after retention |
| Redis / pg_tileserv as nearby futures | Not in the repo until a metric demands them |

v1.0 SQL, MapLibre paint snippets, CAI formula, and OSM field list are still valid **inside the ETL job and the map client**. They are not a deployment topology.

---

*Trail Explorer architecture v1.1 — October 2026*
*Lombardia first. Static first. Community later.*
```