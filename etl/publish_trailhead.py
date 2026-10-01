#!/usr/bin/env python3
"""Mark a reviewed trailhead as published/hidden and optionally rename it.

Writes to trailheads_overrides.csv, which build.py applies on every run.

  python publish_trailhead.py 2205292380 --name "Piani Resinelli — parcheggio"
  python publish_trailhead.py 3756060031 --hide
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

FIELDS = ["id", "published", "name", "note"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id", type=int, help="trailhead id (from trailheads_review.csv or the trailhead JSON)")
    ap.add_argument("--hide", action="store_true", help="hide instead of publish")
    ap.add_argument("--name", default="", help="override the generated name")
    ap.add_argument("--note", default="", help="free text, e.g. 'CAI Lecco 2026-10'")
    ap.add_argument("--file", type=Path, default=Path("trailheads_overrides.csv"))
    args = ap.parse_args()

    rows: dict[int, dict[str, str]] = {}
    if args.file.exists():
        with args.file.open(newline="", encoding="utf-8") as f:
            rows = {int(r["id"]): r for r in csv.DictReader(f)}
    prev = rows.get(args.id, {})
    rows[args.id] = {
        "id": str(args.id),
        "published": "false" if args.hide else "true",
        "name": args.name or prev.get("name", ""),
        "note": args.note or prev.get("note", ""),
    }
    with args.file.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for k in sorted(rows):
            w.writerow({fld: rows[k].get(fld, "") for fld in FIELDS})
    print(f"{'hidden' if args.hide else 'published'} trailhead {args.id} -> {args.file}")


if __name__ == "__main__":
    main()
