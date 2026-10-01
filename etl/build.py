#!/usr/bin/env python3
"""Trail Explorer weekly batch: OSM PBF + Copernicus DEM -> static JSON, GPX, GeoJSON for tippecanoe.

Never run on the public box. See README for the full pipeline.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np
import osmium
import rasterio
from pyproj import Geod, Transformer
from shapely import STRtree
from shapely.geometry import LineString, MultiLineString, Point, mapping
from shapely.ops import linemerge, transform

NETWORKS = {"lwn", "rwn", "nwn", "iwn"}
DIFFICULTY_ORDER = ["T", "E", "EE", "EEA"]
SAC_TO_CAI = {
    "hiking": "T",
    "mountain_hiking": "E",
    "demanding_mountain_hiking": "EE",
    "alpine_hiking": "EE",
    "demanding_alpine_hiking": "EEA",
    "difficult_alpine_hiking": "EEA",
}
CLUSTER_RADIUS_M = 70
SNAP_RADIUS_M = 120
PLACE_NAME_RADIUS_M = 5000
SAMPLE_STEP_M = 100
MAX_CHAIN_GAP_M = 500
SNAP_KINDS = {"parking", "aerialway_station", "bus_stop", "place"}

GEOD = Geod(ellps="WGS84")
TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:32632", always_xy=True).transform
TO_WGS = Transformer.from_crs("EPSG:32632", "EPSG:4326", always_xy=True).transform


@dataclass
class Relation:
    osm_id: int
    tags: dict[str, str]
    way_ids: list[int]


@dataclass
class Poi:
    osm_id: int
    kind: str
    name: str | None
    lng: float
    lat: float


@dataclass
class RunLog:
    started: str
    relations_seen: int = 0
    trails_published: int = 0
    skipped: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)


class RelationPass(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.relations: list[Relation] = []
        self.non_network: int = 0

    def relation(self, r: osmium.osm.Relation) -> None:
        tags = {t.k: t.v for t in r.tags}
        if tags.get("route") != "hiking":
            return
        if tags.get("network") not in NETWORKS:
            self.non_network += 1
            return
        way_ids = [m.ref for m in r.members if m.type == "w" and m.role not in ("guidepost", "information")]
        self.relations.append(Relation(r.id, tags, way_ids))


class WayNodePass(osmium.SimpleHandler):
    def __init__(self, wanted_ways: set[int]) -> None:
        super().__init__()
        self.wanted = wanted_ways
        self.ways: dict[int, list[tuple[float, float, int]]] = {}
        self.way_sac: dict[int, str] = {}
        self.pois: list[Poi] = []
        self.huts: list[Poi] = []

    @staticmethod
    def _poi_kind(tags: dict[str, str]) -> str | None:
        if tags.get("amenity") == "parking":
            return "parking"
        if tags.get("aerialway") == "station":
            return "aerialway_station"
        if tags.get("highway") == "bus_stop":
            return "bus_stop"
        if tags.get("place") in ("city", "town", "village", "hamlet", "locality"):
            return "place"
        return None

    @staticmethod
    def _is_hut(tags: dict[str, str]) -> bool:
        return tags.get("tourism") == "alpine_hut" or tags.get("amenity") == "shelter"

    def node(self, n: osmium.osm.Node) -> None:
        if not n.tags:
            return
        tags = {t.k: t.v for t in n.tags}
        loc = n.location
        if self._is_hut(tags) and tags.get("name"):
            self.huts.append(Poi(n.id, tags.get("tourism") or "shelter", tags["name"], loc.lon, loc.lat))
        kind = self._poi_kind(tags)
        if kind:
            self.pois.append(Poi(n.id, kind, tags.get("name"), loc.lon, loc.lat))

    def way(self, w: osmium.osm.Way) -> None:
        if w.id in self.wanted:
            try:
                self.ways[w.id] = [(nd.lon, nd.lat, nd.ref) for nd in w.nodes]
            except osmium.InvalidLocationError:
                pass
            sac = w.tags.get("sac_scale")
            if sac:
                self.way_sac[w.id] = sac
        tags = {t.k: t.v for t in w.tags}
        if self._is_hut(tags) and tags.get("name") and w.is_closed():
            try:
                pts = [(nd.lon, nd.lat) for nd in w.nodes]
            except osmium.InvalidLocationError:
                return
            lng = sum(p[0] for p in pts) / len(pts)
            lat = sum(p[1] for p in pts) / len(pts)
            self.huts.append(Poi(w.id, tags.get("tourism") or "shelter", tags["name"], lng, lat))


class Dem:
    def __init__(self, vrt: Path) -> None:
        self.ds = rasterio.open(vrt)
        band = self.ds.read(1, masked=True).astype("float32")
        self.grid = band.filled(np.nan)

    def sample(self, coords: list[tuple[float, float]]) -> list[float | None]:
        out: list[float | None] = []
        h, w = self.grid.shape
        for lng, lat in coords:
            row, col = self.ds.index(lng, lat)
            v = self.grid[row, col] if 0 <= row < h and 0 <= col < w else np.nan
            out.append(None if np.isnan(v) else float(v))
        return out


def geodesic_length_m(line: LineString) -> float:
    return float(GEOD.geometry_length(line))


def chain_parts(parts: list[LineString]) -> tuple[LineString, float]:
    """Greedily join merged parts end-to-end into one ordered line. Returns line and the largest gap (m)."""
    remaining = sorted(parts, key=lambda p: p.length, reverse=True)
    chain = list(remaining.pop(0).coords)
    max_gap = 0.0
    while remaining:
        best = None
        for i, part in enumerate(remaining):
            c = list(part.coords)
            for at_end in (True, False):
                anchor = chain[-1] if at_end else chain[0]
                for flip in (False, True):
                    seg = c[::-1] if flip else c
                    joint = seg[0] if at_end else seg[-1]
                    d = GEOD.inv(anchor[0], anchor[1], joint[0], joint[1])[2]
                    if best is None or d < best[0]:
                        best = (d, i, at_end, seg)
        d, i, at_end, seg = best
        remaining.pop(i)
        max_gap = max(max_gap, d)
        chain = chain + seg if at_end else seg + chain
    return LineString(chain), max_gap


def normalise_ref(tags: dict[str, str]) -> str | None:
    ref = tags.get("ref")
    if ref:
        return ref.strip()
    name = tags.get("name", "")
    for token in name.replace("—", " ").replace("-", " ").split():
        if token.isdigit() or (token[:-1].isdigit() and token[-1:].isalpha() and len(token) <= 5):
            return token
    return None


def difficulty_for(rel: Relation, way_sac: dict[int, str]) -> tuple[str | None, str]:
    cai = rel.tags.get("cai_scale", "").upper().strip()
    if cai in DIFFICULTY_ORDER:
        return cai, "cai_scale"
    if rel.tags.get("via_ferrata_scale"):
        return "EEA", "via_ferrata_scale"
    sac = rel.tags.get("sac_scale")
    if sac in SAC_TO_CAI:
        return SAC_TO_CAI[sac], "sac_scale"
    sacs = [SAC_TO_CAI[way_sac[w]] for w in rel.way_ids if way_sac.get(w) in SAC_TO_CAI]
    if sacs:
        return max(sacs, key=DIFFICULTY_ORDER.index), "way_sac_scale"
    return None, "missing"


def derive_tags(t: dict[str, str]) -> list[str]:
    tags: list[str] = []
    if t.get("roundtrip") == "yes":
        tags.append("circolare")
    if t.get("via_ferrata_scale") or "ferrata" in t.get("name", "").lower():
        tags.append("ferrata")
    if t.get("operator", "").lower().startswith(("club alpino italiano", "cai")):
        tags.append("cai")
    return tags


def elevation_profile(line_wgs: LineString, dem: Dem) -> tuple[list[dict], float, float]:
    line_m = transform(TO_UTM, line_wgs)
    total = line_m.length
    n = max(2, math.ceil(total / SAMPLE_STEP_M) + 1)
    dists = np.linspace(0, total, n)
    pts_wgs = [TO_WGS(*line_m.interpolate(d).coords[0]) for d in dists]
    alts = dem.sample(pts_wgs)
    # Scale UTM distance to geodesic length so the chart axis matches length_km.
    scale = geodesic_length_m(line_wgs) / total if total else 1.0
    profile = []
    clean: list[float] = []
    for d, a in zip(dists, alts):
        if a is None:
            continue
        profile.append({"d_km": round(d * scale / 1000, 2), "alt_m": round(a)})
        clean.append(a)
    if len(clean) < 2:
        return profile, 0.0, 0.0
    arr = np.array(clean)
    if len(arr) >= 3:
        arr = np.convolve(np.pad(arr, 1, mode="edge"), np.ones(3) / 3, mode="valid")
    diffs = np.diff(arr)
    return profile, float(diffs[diffs > 0].sum()), float(-diffs[diffs < 0].sum())


def write_gpx(path: Path, name: str, osm_url: str, line: LineString, profile_alts: list[float | None]) -> None:
    pts = []
    for (lng, lat), ele in zip(line.coords, profile_alts):
        ele_xml = f"<ele>{ele:.0f}</ele>" if ele is not None else ""
        pts.append(f'<trkpt lat="{lat:.6f}" lon="{lng:.6f}">{ele_xml}</trkpt>')
    path.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<gpx version="1.1" creator="Trail Explorer" xmlns="http://www.topografix.com/GPX/1/1">\n'
        f'<metadata><name>{escape(name)}</name><link href="{osm_url}"><text>OpenStreetMap</text></link>'
        '<copyright author="OpenStreetMap contributors"><license>https://opendatacommons.org/licenses/odbl/</license></copyright></metadata>\n'
        f"<trk><name>{escape(name)}</name><trkseg>{''.join(pts)}</trkseg></trk>\n</gpx>\n",
        encoding="utf-8",
    )


def round_coords(geom: LineString | MultiLineString, nd: int = 5):
    g = mapping(geom)
    if g["type"] == "LineString":
        g["coordinates"] = [[round(x, nd), round(y, nd)] for x, y in g["coordinates"]]
    else:
        g["coordinates"] = [[[round(x, nd), round(y, nd)] for x, y in part] for part in g["coordinates"]]
    return g


def trail_name(tags: dict[str, str], ref: str | None) -> str:
    name = tags.get("name")
    if name:
        return name
    endpoints = " – ".join(v for v in (tags.get("from"), tags.get("to")) if v)
    if ref and endpoints:
        return f"Sentiero {ref} — {endpoints}"
    if ref:
        return f"Sentiero {ref}"
    return endpoints or "Sentiero senza nome"


class UnionFind:
    def __init__(self, n: int) -> None:
        self.p = list(range(n))

    def find(self, a: int) -> int:
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[max(ra, rb)] = min(ra, rb)


def load_overrides(path: Path) -> dict[int, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8") as f:
        return {int(row["id"]): row for row in csv.DictReader(f)}


def build_trailheads(trails: list[dict], pois: list[Poi], overrides: dict[int, dict[str, str]]):
    endpoints: list[tuple[int, int, tuple[float, float]]] = []  # (trail idx, node id, lnglat)
    for i, t in enumerate(trails):
        endpoints.append((i, t["_start_node"], (t["start"]["lng"], t["start"]["lat"])))
        if not t["_roundtrip_closed"]:
            endpoints.append((i, t["_end_node"], (t["end"]["lng"], t["end"]["lat"])))

    pts_m = [Point(TO_UTM(*e[2])) for e in endpoints]
    tree = STRtree(pts_m)
    uf = UnionFind(len(pts_m))
    left, right = tree.query(pts_m, predicate="dwithin", distance=CLUSTER_RADIUS_M)
    for a, b in zip(left, right):
        uf.union(int(a), int(b))
    clusters: dict[int, list[int]] = {}
    for idx in range(len(endpoints)):
        clusters.setdefault(uf.find(idx), []).append(idx)

    snap_pois = [p for p in pois if p.kind in SNAP_KINDS]
    snap_geoms = [Point(TO_UTM(p.lng, p.lat)) for p in snap_pois]
    snap_tree = STRtree(snap_geoms)
    places = [p for p in pois if p.kind == "place" and p.name]
    place_geoms = [Point(TO_UTM(p.lng, p.lat)) for p in places]
    place_tree = STRtree(place_geoms)

    kind_rank = {"aerialway_station": 0, "parking": 1, "bus_stop": 2, "place": 3}
    published, review = [], []
    for members in clusters.values():
        trail_idx = sorted({endpoints[m][0] for m in members})
        xs = [pts_m[m].x for m in members]
        ys = [pts_m[m].y for m in members]
        centroid = Point(sum(xs) / len(xs), sum(ys) / len(ys))
        th_id = min(endpoints[m][1] for m in members)

        near = snap_tree.query(centroid, predicate="dwithin", distance=SNAP_RADIUS_M)
        snapped = None
        if len(near):
            snapped = min(
                (snap_pois[int(j)] for j in near),
                key=lambda p: (kind_rank[p.kind], centroid.distance(Point(TO_UTM(p.lng, p.lat)))),
            )
        nearest_place = None
        pj = place_tree.query_nearest(centroid, max_distance=PLACE_NAME_RADIUS_M)
        if len(pj):
            nearest_place = places[int(pj[0])].name

        kind_label = {"parking": "Parcheggio", "aerialway_station": "Stazione funivia", "bus_stop": "Fermata bus"}
        if snapped and snapped.name:
            name = snapped.name
        elif snapped and snapped.kind in kind_label and nearest_place:
            name = f"{kind_label[snapped.kind]} — {nearest_place}"
        elif nearest_place:
            name = f"Partenza vicino a {nearest_place}"
        else:
            name = "Partenza sentieri"

        lng, lat = TO_WGS(centroid.x, centroid.y)
        auto = len(trail_idx) >= 2 or snapped is not None
        th = {
            "id": th_id,
            "name": name,
            "lng": round(lng, 5),
            "lat": round(lat, 5),
            "trail_count": len(trail_idx),
            "_trail_idx": trail_idx,
            "_snapped": f"{snapped.kind}:{snapped.osm_id}" if snapped else "",
            "_published": auto,
        }
        ov = overrides.get(th_id)
        if ov:
            if ov.get("name"):
                th["name"] = ov["name"]
            if ov.get("published", "").strip().lower() in ("true", "false"):
                th["_published"] = ov["published"].strip().lower() == "true"
        (published if th["_published"] else review).append(th)
    return published, review


def sort_key(t: dict):
    d = t.get("difficulty")
    return (DIFFICULTY_ORDER.index(d) if d in DIFFICULTY_ORDER else len(DIFFICULTY_ORDER), t["length_km"])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pbf", type=Path, default=Path("cache/lombardia.osm.pbf"))
    ap.add_argument("--dem-dir", type=Path, default=Path("cache/dem"))
    ap.add_argument("--out", type=Path, default=Path("out"))
    ap.add_argument("--overrides", type=Path, default=Path("trailheads_overrides.csv"))
    ap.add_argument("--limit", type=int, default=0, help="debug: only process N relations")
    args = ap.parse_args()

    t0 = time.time()
    log = RunLog(started=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    work = args.out / "work"
    data = args.out / "data"
    for d in (work, data / "trailheads", data / "trails"):
        if d.exists() and d != work:
            shutil.rmtree(d)
        d.mkdir(parents=True, exist_ok=True)

    filtered = work / "filtered.osm.pbf"
    print("[1/6] osmium tags-filter", flush=True)
    subprocess.run(
        [
            "osmium",
            "tags-filter",
            str(args.pbf),
            "r/route=hiking",
            "nw/tourism=alpine_hut",
            "nw/amenity=shelter",
            "n/amenity=parking",
            "n/aerialway=station",
            "n/highway=bus_stop",
            "n/place=city,town,village,hamlet,locality",
            "-o",
            str(filtered),
            "--overwrite",
        ],
        check=True,
    )

    print("[2/6] reading relations / ways", flush=True)
    rp = RelationPass()
    rp.apply_file(str(filtered))
    relations = rp.relations[: args.limit] if args.limit else rp.relations
    log.relations_seen = len(relations)
    wp = WayNodePass({w for r in relations for w in r.way_ids})
    wp.apply_file(str(filtered), locations=True)

    vrt = work / "dem.vrt"
    tifs = sorted(str(p) for p in args.dem_dir.glob("*.tif"))
    subprocess.run(["gdalbuildvrt", "-q", "-overwrite", "-resolution", "highest", str(vrt), *tifs], check=True)
    dem = Dem(vrt)

    print(f"[3/6] building {len(relations)} trails", flush=True)
    trails: list[dict] = []
    for rel in relations:
        coords_by_way = [wp.ways[w] for w in rel.way_ids if w in wp.ways and len(wp.ways[w]) >= 2]
        if not coords_by_way:
            log.skipped.append({"osm_id": rel.osm_id, "reason": "no way geometry (superroute or outside extract)"})
            continue
        node_at = {(c[0], c[1]): c[2] for way in coords_by_way for c in way}
        merged = linemerge([LineString([(c[0], c[1]) for c in way]) for way in coords_by_way])
        parts = [merged] if isinstance(merged, LineString) else list(merged.geoms)
        line, gap = chain_parts(parts) if len(parts) > 1 else (parts[0], 0.0)
        if len(parts) > 1:
            log.warnings.append({"osm_id": rel.osm_id, "issue": "fragmented", "parts": len(parts), "max_gap_m": round(gap)})
        if gap > MAX_CHAIN_GAP_M * 10:
            log.skipped.append({"osm_id": rel.osm_id, "reason": f"broken geometry, gap {round(gap)} m"})
            continue

        length_m = geodesic_length_m(MultiLineString(parts)) if len(parts) > 1 else geodesic_length_m(line)
        if length_m < 200:
            log.skipped.append({"osm_id": rel.osm_id, "reason": "shorter than 200 m"})
            continue
        profile, gain, loss = elevation_profile(line, dem)
        difficulty, diff_src = difficulty_for(rel, wp.way_sac)
        ref = normalise_ref(rel.tags)
        length_km = round(length_m / 1000, 1)
        start, end = line.coords[0], line.coords[-1]
        closed = GEOD.inv(start[0], start[1], end[0], end[1])[2] < CLUSTER_RADIUS_M
        trails.append(
            {
                "id": rel.osm_id,
                "osm_id": rel.osm_id,
                "osm_url": f"https://www.openstreetmap.org/relation/{rel.osm_id}",
                "name": trail_name(rel.tags, ref),
                "cai_ref": ref,
                "difficulty": difficulty,
                "difficulty_source": diff_src,
                "network": rel.tags.get("network"),
                "length_km": length_km,
                "elevation_gain_m": round(gain),
                "elevation_loss_m": round(loss),
                "duration_hours": round(length_km / 4 + gain / 400, 1),
                "tags": derive_tags(rel.tags),
                "description": rel.tags.get("description") or None,
                "from": rel.tags.get("from") or None,
                "to": rel.tags.get("to") or None,
                "operator": rel.tags.get("operator") or None,
                "start": {"lng": round(start[0], 5), "lat": round(start[1], 5)},
                "end": {"lng": round(end[0], 5), "lat": round(end[1], 5)},
                "geometry": round_coords(line),
                "_map_geometry": round_coords(MultiLineString(parts) if len(parts) > 1 else line),
                "elevation_profile": profile,
                "gpx_url": f"/data/trails/{rel.osm_id}.gpx",
                "_start_node": node_at.get(start, 0),
                "_end_node": node_at.get(end, 0),
                "_roundtrip_closed": closed,
                "_line": line,
            }
        )
    log.trails_published = len(trails)

    print("[4/6] trailheads", flush=True)
    published, review = build_trailheads(trails, wp.pois, load_overrides(args.overrides))
    trail_trailheads: dict[int, list[int]] = {}
    for th in published:
        for i in th["_trail_idx"]:
            trail_trailheads.setdefault(trails[i]["id"], []).append(th["id"])

    print("[5/6] writing JSON / GPX / GeoJSON", flush=True)
    summary_keys = [
        "id",
        "name",
        "cai_ref",
        "difficulty",
        "length_km",
        "elevation_gain_m",
        "elevation_loss_m",
        "duration_hours",
        "tags",
    ]
    for th in published:
        rows = sorted((trails[i] for i in th["_trail_idx"]), key=sort_key)
        payload = {k: th[k] for k in ("id", "name", "lng", "lat", "trail_count")}
        payload["trails"] = [{k: t[k] for k in summary_keys} for t in rows]
        (data / "trailheads" / f"{th['id']}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )

    th_by_id = {th["id"]: th for th in published}
    trail_features, index = [], []
    for t in trails:
        line: LineString = t["_line"]
        alts = dem.sample(list(line.coords))
        write_gpx(data / "trails" / f"{t['id']}.gpx", t["name"], t["osm_url"], line, alts)
        out = {k: v for k, v in t.items() if not k.startswith("_")}
        out["trailheads"] = [{"id": i, "name": th_by_id[i]["name"]} for i in trail_trailheads.get(t["id"], [])]
        (data / "trails" / f"{t['id']}.json").write_text(
            json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        trail_features.append(
            {
                "type": "Feature",
                "properties": {"id": t["id"], "difficulty": t["difficulty"] or "?", "cai_ref": t["cai_ref"] or ""},
                "geometry": t["_map_geometry"],
            }
        )
        index.append({"id": t["id"], "name": t["name"]})

    def fc(features):
        return {"type": "FeatureCollection", "features": features}

    (work / "trails.geojson").write_text(json.dumps(fc(trail_features)), encoding="utf-8")
    (work / "trailheads.geojson").write_text(
        json.dumps(
            fc(
                [
                    {
                        "type": "Feature",
                        "properties": {"id": th["id"], "name": th["name"], "trail_count": th["trail_count"]},
                        "geometry": {"type": "Point", "coordinates": [th["lng"], th["lat"]]},
                    }
                    for th in published
                ]
            ),
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (work / "huts.geojson").write_text(
        json.dumps(
            fc(
                [
                    {
                        "type": "Feature",
                        "properties": {"name": h.name, "kind": h.kind},
                        "geometry": {"type": "Point", "coordinates": [round(h.lng, 5), round(h.lat, 5)]},
                    }
                    for h in wp.huts
                ]
            ),
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (data / "trails_index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    with (args.out / "trailheads_review.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "lat", "lng", "trail_count", "snapped", "osm_link", "published"])
        for th in sorted(review, key=lambda x: -x["trail_count"]):
            w.writerow(
                [
                    th["id"],
                    th["name"],
                    th["lat"],
                    th["lng"],
                    th["trail_count"],
                    th["_snapped"],
                    f"https://www.openstreetmap.org/?mlat={th['lat']}&mlon={th['lng']}#map=17/{th['lat']}/{th['lng']}",
                    "false",
                ]
            )

    print("[6/6] tippecanoe", flush=True)
    tiles = args.out / "tiles"
    tiles.mkdir(exist_ok=True)
    tip = ["tippecanoe", "--force", "--quiet", "--no-tile-compression"]
    subprocess.run(
        [
            *tip,
            "-o",
            str(tiles / "trails.pmtiles"),
            "-l",
            "trails",
            "-Z5",
            "-z14",
            "--drop-smallest-as-needed",
            "--simplification=4",
            str(work / "trails.geojson"),
        ],
        check=True,
    )
    subprocess.run(
        [
            *tip,
            "-o",
            str(tiles / "trailheads.pmtiles"),
            "-l",
            "trailheads",
            "-Z5",
            "-z14",
            "-r1",
            "--cluster-distance=35",
            "--cluster-maxzoom=12",
            "--accumulate-attribute=trail_count:sum",
            str(work / "trailheads.geojson"),
        ],
        check=True,
    )
    subprocess.run(
        [*tip, "-o", str(tiles / "huts.pmtiles"), "-l", "huts", "-Z8", "-z14", "-r1", str(work / "huts.geojson")], check=True
    )

    etl_run = {
        "started": log.started,
        "finished": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "duration_s": round(time.time() - t0),
        "source_pbf": args.pbf.name,
        "relations_seen": log.relations_seen,
        "relations_outside_networks": rp.non_network,
        "trails_published": log.trails_published,
        "trailheads_published": len(published),
        "trailheads_in_review": len(review),
        "huts": len(wp.huts),
        "difficulty_missing": sum(1 for t in trails if t["difficulty"] is None),
        "skipped": log.skipped,
        "warnings": log.warnings,
    }
    (args.out / "etl_run.json").write_text(json.dumps(etl_run, ensure_ascii=False, indent=1), encoding="utf-8")
    (data / "etl_run.json").write_text(
        json.dumps({k: v for k, v in etl_run.items() if k not in ("skipped", "warnings")}, indent=1), encoding="utf-8"
    )
    print(json.dumps({k: v for k, v in etl_run.items() if k not in ("skipped", "warnings")}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
