#!/usr/bin/env python3
"""Build offline 0.1-degree parking/rest/hotel POI tiles from an OSM .pbf extract.

Requires: pip install osmium
Usage: python3 scripts/build_rest_stops.py path/to/greece.osm.pbf
Outputs: public/data/rest-stops/manifest.json and tiles/*.json
"""
import argparse
import json
import math
from pathlib import Path

try:
    import osmium
except ImportError as exc:
    raise SystemExit("Install dependency: python3 -m pip install osmium") from exc

def kind(tags):
    if tags.get("tourism") in ("hotel", "motel", "guest_house"):
        return "hotel"
    if tags.get("highway") in ("rest_area", "services"):
        return tags.get("highway")
    if tags.get("amenity") == "parking":
        return "parking"
    return None

class Collector(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.tiles = {}
        self.seen = set()

    def add(self, prefix, item_id, tags, lng, lat):
        category = kind(tags)
        if category is None or not math.isfinite(lng) or not math.isfinite(lat):
            return
        key_id = f"{prefix}{item_id}"
        if key_id in self.seen:
            return
        self.seen.add(key_id)
        key = f"{math.floor(lng * 10)}_{math.floor(lat * 10)}"
        self.tiles.setdefault(key, []).append({
            "id": key_id,
            "kind": category,
            "name": tags.get("name") or category.replace("_", " ").title(),
            "lng": round(lng, 7),
            "lat": round(lat, 7),
        })

    def node(self, n):
        if not n.location.valid():
            return
        self.add("n", n.id, n.tags, n.location.lon, n.location.lat)

    def area(self, a):
        # Areas need a centroid. The first valid outer-ring vertex is used as a
        # representative point; a road-access point is resolved later in-game.
        if kind(a.tags) is None:
            return
        for ring in a.outer_rings():
            for vertex in ring:
                if vertex.location.valid():
                    self.add("a", a.orig_id(), a.tags, vertex.location.lon, vertex.location.lat)
                    return

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pbf", type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/data/rest-stops"))
    args = parser.parse_args()
    collector = Collector()
    collector.apply_file(str(args.pbf), locations=True)
    tile_dir = args.output / "tiles"
    tile_dir.mkdir(parents=True, exist_ok=True)
    for key, entries in collector.tiles.items():
        (tile_dir / f"{key}.json").write_text(json.dumps(entries, separators=(",", ":"), ensure_ascii=False))
    (args.output / "manifest.json").write_text(json.dumps({
        "version": 1, "source": "OpenStreetMap extract",
        "tileDegrees": 0.1, "tiles": sorted(collector.tiles),
    }, indent=2))
    print(f"Created {len(collector.tiles)} tiles with {len(collector.seen)} rest POIs")

if __name__ == "__main__":
    main()
