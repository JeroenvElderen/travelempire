#!/usr/bin/env python3
"""Audit all of Greece and stage only missing taxi/PSV-permitted OSM roads.

Uses the existing PBF and currently deployed v2 manifest/tiles. Unlike a full
road rebuild, existing road IDs/geometry/direction stay unchanged. Private
roads WITHOUT explicit taxi/PSV permission remain excluded.

No live Supabase objects or game manifest are changed by this command.

Example:
 python scripts/repair_greece_taxi_access.py \\
   --pbf data/osm/greece-261028.osm.pbf \\
   --source-dir data/road-tiles-v2 \\
   --output data/greece-taxi-audit

Outputs:
 <output>/tiles-manifest.json     only changed files (uploader input)
 <output>/activate-manifest.json  complete updated in-game manifest
 <output>/validation.json         review report, manifest fingerprint
 <output>/*.v2.jsonl.gz           immutable replacement tiles

After human review, upload the tiles, run the separate manifest activation
validator, commit the activated manifest and deploy Cloudflare.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import urllib.parse
import urllib.request

try:
    import osmium
except ImportError as error:
    raise SystemExit("Install in your active venv: python -m pip install osmium") from error

from osm_taxi_access import taxi_access_exception, taxi_oneway, vertical_metadata

BUCKET = "travelempire-road-tiles"
FORMAT = "travelempire-road-tiles-v2-levels"
DEFAULT_SIZE = 0.1
SPEEDS = {
    "motorway": 110, "motorway_link": 60, "trunk": 100, "trunk_link": 50,
    "primary": 90, "primary_link": 40, "secondary": 70, "secondary_link": 40,
    "tertiary": 50, "tertiary_link": 30, "unclassified": 50,
    "residential": 40, "living_street": 15, "service": 20, "road": 30,
    "track": 20,
}


def metres(a, b):
    latitude = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * 111320 * math.cos(latitude),
                      (a[1] - b[1]) * 111320)


def tile_id(point, size):
    return f"{math.floor(point[0] / size)}_{math.floor(point[1] / size)}"


def canonical_bytes(roads):
    return b"".join(json.dumps(road, separators=(",", ":"), ensure_ascii=False).encode("utf-8") + b"\n"
                    for road in roads)


class TaxiExemptionScanner(osmium.SimpleHandler):
    """Single bounded-memory full-PBF pass, retaining exception ways only."""
    def __init__(self, size):
        super().__init__()
        self.size = size
        self.by_tile = defaultdict(dict)
        self.count = Counter()
        self.review = []

    def way(self, way):
        self.count["ways_scanned"] += 1
        if self.count["ways_scanned"] % 1_000_000 == 0:
            print(f"Scanned {self.count['ways_scanned']:,} OSM ways; "
                  f"{self.count['eligible_ways']:,} restricted taxi/PSV exception ways", flush=True)
        tags = {tag.k: tag.v for tag in way.tags}
        if not taxi_access_exception(tags):
            if tags.get("taxi") or tags.get("psv"):
                if any(tags.get(k) in {"no", "private"} for k in ("access", "vehicle", "motor_vehicle", "motorcar")):
                    self.count["restricted_with_other_or_ambiguous_permission"] += 1
            return
        nodes = list(way.nodes)
        if len(nodes) < 2:
            self.count["candidate_ways_without_segments"] += 1
            return
        if any(not n.location.valid() for n in nodes):
            self.count["candidate_ways_missing_coordinates"] += 1
            if len(self.review) < 100:
                self.review.append({"way": way.id, "reason": "unlocated-node"})
            return
        self.count["eligible_ways"] += 1
        vertical = vertical_metadata(tags)
        direction = taxi_oneway(tags)
        for i in range(len(nodes)-1):
            a_node, b_node = nodes[i], nodes[i+1]
            a, b = [a_node.location.lon, a_node.location.lat], [b_node.location.lon, b_node.location.lat]
            if a == b:
                continue
            mid = ((a[0]+b[0])/2, (a[1]+b[1])/2)
            tile = tile_id(mid, self.size)
            edge_id = f"osm-{way.id}-{i}"
            length = metres(a, b)
            if length <= 0 or not math.isfinite(length):
                self.count["invalid_segment_length"] += 1
                continue
            self.by_tile[tile][edge_id] = {
                "id": edge_id,
                "a": a_node.ref, "b": b_node.ref,
                "coordinates": [a, b], "length": length,
                "highway": tags["highway"], "speed": SPEEDS.get(tags["highway"], 40),
                "oneway": direction, "taxiOnly": True, **vertical,
            }
            self.count["eligible_segments"] += 1


def read_existing_tile(info, source_dir, cache_dir, base_url):
    filename = info["file"]
    local = source_dir / filename
    if local.is_file():
        return local.read_bytes(), str(local)
    if not base_url.startswith("https://"):
        raise RuntimeError(f"Missing local active tile {filename}; set SUPABASE_URL to fetch it")
    url = (base_url.rstrip("/") + "/storage/v1/object/public/" + BUCKET + "/"
           + urllib.parse.quote(filename, safe=""))
    req = urllib.request.Request(url, headers={"User-Agent": "TravelEmpire-Taxi-Access-Audit/1"})
    with urllib.request.urlopen(req, timeout=120) as response:
        packed = response.read()
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / filename).write_bytes(packed)
    return packed, url


def stage_tile(tile, candidates, manifest_entry, source_dir, output, base_url):
    raw, source = read_existing_tile(manifest_entry, source_dir, output / ".sources", base_url)
    try:
        existing = [json.loads(line) for line in gzip.decompress(raw).splitlines() if line.strip()]
    except Exception as error:
        raise RuntimeError(f"Unreadable {source}: {error}") from error
    baseline_ids = [r["id"] for r in existing]
    if len(baseline_ids) != len(set(baseline_ids)):
        raise RuntimeError(f"Existing tile {tile} contains duplicate edge IDs")
    by_id = {r["id"]: r for r in existing}
    additions = []
    flag_updates = 0
    for edge_id, candidate in sorted(candidates.items()):
        found = by_id.get(edge_id)
        if found is not None:
            if (str(found.get("a")) != str(candidate["a"]) or
                str(found.get("b")) != str(candidate["b"])):
                raise RuntimeError(f"OSM ID collision / changed segment geometry: {tile}/{edge_id}")
            if not found.get("taxiOnly"):
                found["taxiOnly"] = True
                flag_updates += 1
            continue
        additions.append(candidate)

    if not additions and not flag_updates:
        return None
    new_roads = existing + additions
    if [r["id"] for r in new_roads[:len(existing)]] != baseline_ids:
        raise RuntimeError(f"Original segment IDs changed in tile {tile}")
    if len({r["id"] for r in new_roads}) != len(new_roads):
        raise RuntimeError(f"Duplicate edge IDs in new tile {tile}")
    data = canonical_bytes(new_roads)
    digest = hashlib.sha256(data).hexdigest()[:14]
    filename = f"{tile}.taxi-permitted-{digest}.v2.jsonl.gz"
    (output / filename).write_bytes(gzip.compress(data, compresslevel=6, mtime=0))
    old_nodes = {str(n) for r in existing for n in (r.get("a"), r.get("b"))}
    touches = sum(bool(str(r["a"]) in old_nodes or str(r["b"]) in old_nodes) for r in additions)
    return {
        "tile": tile, "original_file": manifest_entry["file"], "new_file": filename,
        "original_count": len(existing), "new_count": len(new_roads),
        "added": len(additions), "access_flags_corrected": flag_updates,
        "new_segments_touching_existing_nodes": touches,
        "source": source,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--pbf", type=Path, default=Path("data/osm/greece-261028.osm.pbf"))
    p.add_argument("--manifest", type=Path, default=Path("public/data/roads/tiles-manifest.json"))
    p.add_argument("--source-dir", type=Path, default=Path("data/road-tiles-v2"))
    p.add_argument("--output", type=Path, default=Path("data/greece-taxi-audit"))
    p.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL", ""))
    args = p.parse_args()
    for path in (args.pbf, args.manifest):
        if not path.is_file():
            p.error("Input file not found: " + str(path))
    if args.output.exists() and any(args.output.iterdir()):
        p.error("Output directory already has files; choose a fresh --output path")
    if args.source_dir.resolve() == args.output.resolve():
        p.error("Source and output directories must differ")
    manifest_bytes = args.manifest.read_bytes()
    original_manifest = json.loads(manifest_bytes)
    if original_manifest.get("format") != FORMAT or original_manifest.get("tileSize") != DEFAULT_SIZE:
        p.error("Expected the v2 Greece tile manifest; refusing to patch another format")
    tiles = original_manifest["tiles"]
    print(f"Scanning all restricted taxi/PSV exceptions in {args.pbf}", flush=True)
    scanner = TaxiExemptionScanner(original_manifest["tileSize"])
    scanner.apply_file(str(args.pbf), locations=True, idx="flex_mem")
    print(f"Found {scanner.count['eligible_ways']:,} exception ways and "
          f"{scanner.count['eligible_segments']:,} segments in "
          f"{len(scanner.by_tile):,} geographic tiles", flush=True)

    changed = []
    missing_tiles = {}
    new_entries = {}
    args.output.mkdir(parents=True, exist_ok=True)
    for i, (tile, candidates) in enumerate(sorted(scanner.by_tile.items()), 1):
        info = tiles.get(tile)
        if info is None:
            missing_tiles[tile] = len(candidates)
            continue
        record = stage_tile(tile, candidates, info, args.source_dir, args.output, args.supabase_url)
        if record is not None:
            changed.append(record)
            new_entries[tile] = {"file": record["new_file"], "edges": record["new_count"]}
            print(f"[{i}/{len(scanner.by_tile)}] {tile}: +{record['added']} segments, "
                  f"{record['access_flags_corrected']} reclassified", flush=True)

    activated = json.loads(manifest_bytes)
    activated["tiles"].update(new_entries)
    upload_manifest = {
        "format": original_manifest["format"], "tileSize": original_manifest["tileSize"],
        "tiles": new_entries,
    }
    (args.output / "activate-manifest.json").write_text(
        json.dumps(activated, ensure_ascii=False, indent=2) + "\n")
    (args.output / "tiles-manifest.json").write_text(
        json.dumps(upload_manifest, ensure_ascii=False, indent=2) + "\n")

    report = {
        "scope": "Taxi/PSV overrides for generally restricted drivable OSM roads",
        "localPbf": str(args.pbf),
        "existingManifest": str(args.manifest),
        "originalManifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "osmCounts": dict(scanner.count),
        "totalSourceTiles": len(tiles),
        "affectedTiles": len(changed),
        "addedSegments": sum(r["added"] for r in changed),
        "reclassifiedExistingSegments": sum(r["access_flags_corrected"] for r in changed),
        "existingRoadIdsPreserved": True,
        "missingManifestTiles": missing_tiles,
        "missingManifestSegments": sum(missing_tiles.values()),
        "invalidCandidateSamples": scanner.review,
        "modifiedTiles": changed,
        "readyForReview": True,
        "readyForActivation": not missing_tiles and scanner.count["candidate_ways_missing_coordinates"] == 0,
        "uploaded": False,
    }
    (args.output / "validation.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("\nSUMMARY", flush=True)
    print(json.dumps({k: report[k] for k in (
        "affectedTiles", "addedSegments", "reclassifiedExistingSegments",
        "missingManifestSegments", "readyForActivation",
    )}, indent=2), flush=True)
    print(f"Report: {args.output / 'validation.json'}")
    print("STAGED ONLY: no live files or game manifest were changed.")


if __name__ == "__main__":
    main()
