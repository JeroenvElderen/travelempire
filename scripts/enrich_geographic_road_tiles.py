#!/usr/bin/env python3
"""Create v2 geographic tiles with OSM vertical metadata from existing tiles + PBF.

Requires: pip install osmium
Example:
 python3 scripts/enrich_geographic_road_tiles.py \
   --input /path/to/current-tiles --pbf /path/to/greece.osm.pbf \
   --output /path/to/tiles-v2

Existing tiles are never changed. The output contains new *.v2.jsonl.gz files
and a v2 tiles-manifest.json. Upload ALL new .gz files to the existing public
Supabase 'travelempire-road-tiles' bucket BEFORE deploying the new manifest.
"""
import argparse
import gzip
import json
import re
from collections import Counter
from pathlib import Path

try:
    import osmium
except ImportError as exc:
    raise SystemExit("Install osmium first: python3 -m pip install osmium") from exc


def parse_number(value):
    if value is None:
        return None
    try:
        result = float(value)
        if result != result or abs(result) > 1_000_000:
            return None
        return int(result) if result.is_integer() else result
    except (ValueError, TypeError):
        return None


def parse_vertical_tags(tags):
    layer = parse_number(tags.get("layer"))
    level = parse_number(tags.get("level"))
    bridge = tags.get("bridge", "no").lower() not in {"no", "false", "0"}
    tunnel = tags.get("tunnel", "no").lower() not in {"no", "false", "0"}
    result = {}
    if layer is not None and layer != 0:
        result["layer"] = layer
    if level is not None:
        result["level"] = level
    if bridge:
        result["bridge"] = True
    if tunnel:
        result["tunnel"] = True
    return result


def way_id(road, pattern):
    explicit = road.get("osmWayId", road.get("wayId"))
    if explicit is not None:
        return int(explicit) if str(explicit).isdigit() else None
    raw = str(road.get("id", ""))
    match = pattern.match(raw)
    if match:
        return int(match.group(1))
    # Supplemental ferry-terminal tiles use osm-<way-id>-<segment-index>.
    alternate = re.match(r"^osm-(\d+)-\d+$", raw)
    return int(alternate.group(1)) if alternate else None


class VerticalWays(osmium.SimpleHandler):
    def __init__(self, wanted):
        super().__init__()
        self.wanted = wanted
        self.metadata = {}
        self.found = 0
        self.found_ids = set()

    def way(self, way):
        if way.id not in self.wanted:
            return
        self.found += 1
        self.found_ids.add(way.id)
        tags = parse_vertical_tags(way.tags)
        if tags:
            self.metadata[way.id] = tags


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Directory with current tiles and tiles-manifest.json")
    parser.add_argument("--pbf", type=Path, required=True, help="Original Greece .osm.pbf file")
    parser.add_argument("--output", type=Path, required=True, help="New directory (must not already contain tiles)")
    parser.add_argument("--way-id-pattern", default=r"^(?:[^:]+:)?(\d+):\d+:\d+(?::\d+)?$",
                        help="Regex for a stored road ID; capturing group 1 must be the OSM way ID")
    args = parser.parse_args()
    manifest_path = args.input / "tiles-manifest.json"
    if not manifest_path.is_file() or not args.pbf.is_file():
        parser.error("Input manifest and PBF file must both exist")
    if args.input.resolve() == args.output.resolve():
        parser.error("Output must differ from input; never overwrite live tiles")
    if args.output.exists() and any(args.output.iterdir()):
        parser.error("Output directory must be empty for a safe staged deployment")
    manifest = json.loads(manifest_path.read_text())
    pattern = re.compile(args.way_id_pattern)
    if pattern.groups < 1:
        parser.error("--way-id-pattern requires a capture group containing the OSM way ID")
    tiles = manifest["tiles"]
    wanted = set()
    segment_counts_by_way = Counter()
    unrecognized = []
    total = 0
    for tile in tiles.values():
        source = args.input / tile["file"]
        if not source.is_file():
            raise SystemExit(f"Missing source tile: {source}")
        with gzip.open(source, "rt") as stream:
            for line in stream:
                if not line.strip():
                    continue
                road = json.loads(line)
                total += 1
                identifier = way_id(road, pattern)
                if identifier is not None:
                    wanted.add(identifier)
                    segment_counts_by_way[identifier] += 1
                elif len(unrecognized) < 5:
                    unrecognized.append(str(road.get("id")))
    if not total:
        raise SystemExit("No road segments found in source tiles")
    if not wanted:
        raise SystemExit(f"Could not extract any OSM way IDs. Sample IDs: {unrecognized}. Supply --way-id-pattern.")
    print(f"Scanning PBF for {len(wanted):,} unique OSM way IDs", flush=True)
    handler = VerticalWays(wanted)
    handler.apply_file(str(args.pbf), locations=False)
    if handler.found < len(wanted) * 0.90:
        raise SystemExit(f'Only {handler.found:,}/{len(wanted):,} OSM way IDs matched the PBF. Check the ID regex and PBF version; no tiles written.')
    # Avoid marking a partially mismatched new PBF as equivalent to the
    # live network. Most saved segments MUST reference still-present OSM ways.
    matched_segments = sum(count for identifier, count in segment_counts_by_way.items()
                           if identifier in handler.found_ids)
    if matched_segments < total * 0.95:
        raise SystemExit(f'Only {matched_segments:,}/{total:,} saved road segments match OSM way IDs in this PBF; do NOT deploy. Use the matching extract.')
    args.output.mkdir(parents=True, exist_ok=True)
    new_tiles = {}
    matches = 0
    with_metadata = 0
    for tile_id, tile in sorted(tiles.items()):
        target = f"{tile_id}.v2.jsonl.gz"
        count = 0
        with gzip.open(args.input / tile["file"], "rt") as source, gzip.open(args.output / target, "wt", compresslevel=6) as dest:
            for line in source:
                if not line.strip():
                    continue
                road = json.loads(line)
                identifier = way_id(road, pattern)
                if identifier is not None and identifier in handler.found_ids:
                    matches += 1
                tags = handler.metadata.get(identifier) if identifier is not None else None
                if tags:
                    # Avoid overwriting routing IDs, geometry, speeds or one-way metadata.
                    road.update(tags)
                    with_metadata += 1
                dest.write(json.dumps(road, separators=(",", ":")) + "\n")
                count += 1
        new_tiles[tile_id] = {"file": target, "edges": count}
    print(f"Segments: {total:,}; matched segments: {matches:,}; matched OSM ways: {handler.found:,}; metadata-enriched: {with_metadata:,}", flush=True)
    if unrecognized:
        print("Unrecognized ID examples:", ", ".join(unrecognized), flush=True)
    if matches < total * 0.95:
        raise SystemExit("Less than 95% of road segments matched the PBF. Do NOT deploy these tiles. Check the extract version and --way-id-pattern.")
    result = {"format": "travelempire-road-tiles-v2-levels", "tileSize": manifest["tileSize"], "tiles": new_tiles}
    (args.output / "tiles-manifest.json").write_text(json.dumps(result, indent=2))
    print("Staged v2 tiles are ready. Upload the new files first, then deploy the v2 manifest.", flush=True)


if __name__ == "__main__":
    main()
