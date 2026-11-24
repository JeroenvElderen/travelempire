#!/usr/bin/env python3
"""Build 0.1-degree collector-supplier tiles from an OSM PBF extract.

pip install osmium
python scripts/build_collector_suppliers.py greece.osm.pbf
"""
import argparse
import json
import math
from pathlib import Path

def resource_parts(tags):
    if tags.get("access") in ("private", "no"):
        return []
    shop, amenity = tags.get("shop"), tags.get("amenity")
    industrial, office = tags.get("industrial"), tags.get("office")
    if shop in ("car_repair", "car_parts", "tyres", "motorcycle_repair"):
        return ["mechanical"]
    if shop in ("electronics", "computer", "mobile_phone", "electrical"):
        return ["electronics"]
    if shop in ("trade", "hardware", "doityourself", "building_materials"):
        return ["construction"]
    if amenity in ("fuel", "charging_station") or tags.get("power") in ("plant", "substation"):
        return ["energy"]
    if tags.get("harbour") in ("yes", "industrial") or tags.get("man_made") == "shipyard" or amenity == "ferry_terminal":
        return ["marine"]
    if amenity in ("university", "college") or office == "research":
        return ["research"]
    if office or amenity in ("bank", "townhall"):
        return ["business"]
    if industrial in ("warehouse", "logistics", "factory") or tags.get("building") == "warehouse":
        return ["construction", "mechanical", "rare"]
    return []

def main():
    import osmium
    parser = argparse.ArgumentParser()
    parser.add_argument("pbf", type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/data/collector-suppliers"))
    args = parser.parse_args()

    class Handler(osmium.SimpleHandler):
        def __init__(self):
            super().__init__()
            self.tiles = {}
            self.seen = set()

        def add(self, id_, tags, lng, lat):
            parts = resource_parts(tags)
            if not parts or id_ in self.seen or not math.isfinite(lng) or not math.isfinite(lat):
                return
            self.seen.add(id_)
            key = f"{math.floor(lng * 10)}_{math.floor(lat * 10)}"
            name = tags.get("name") or tags.get("brand") or tags.get("shop") or tags.get("industrial") or tags.get("amenity") or "Mapped supply location"
            self.tiles.setdefault(key, []).append({"id": id_, "name": name.replace("_", " "), "lng": round(lng, 7), "lat": round(lat, 7), "parts": parts})

        def node(self, n):
            if n.location.valid() and resource_parts(n.tags):
                self.add(f"n{n.id}", n.tags, n.location.lon, n.location.lat)

        def way(self, w):
            if not resource_parts(w.tags):
                return
            points = [(n.location.lon, n.location.lat) for n in w.nodes if n.location.valid()]
            if points:
                self.add(f"w{w.id}", w.tags, sum(p[0] for p in points)/len(points), sum(p[1] for p in points)/len(points))

    handler = Handler()
    handler.apply_file(str(args.pbf), locations=True)
    tile_dir = args.output / "tiles"
    tile_dir.mkdir(parents=True, exist_ok=True)
    for key, entries in handler.tiles.items():
        (tile_dir / f"{key}.json").write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (args.output / "manifest.json").write_text(json.dumps({"version": 1, "source": "OpenStreetMap extract", "tileDegrees": 0.1, "tiles": sorted(handler.tiles)}, indent=2), encoding="utf-8")
    print(f"Built {len(handler.seen)} supplier locations across {len(handler.tiles)} tiles")

if __name__ == "__main__":
    main()
