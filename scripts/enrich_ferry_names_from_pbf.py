#!/usr/bin/env python3
"""Recover the real names of existing TravelEmpire ferry terminals from a local OSM PBF.

Uses each SAVED harbour's coordinates as the matching reference. No harbour IDs,
route IDs, endpoint locations, voyage times or geometry are modified.

  python scripts/enrich_ferry_names_from_pbf.py \
    --pbf /path/to/greece.osm.pbf \
    --network data/current-GRC.json \
    --output data/GRC-named.json

Install: python -m pip install osmium

The output is for REVIEW first: it is NOT uploaded automatically.
"""
import argparse
import collections
import json
import math
from pathlib import Path
import osmium

PLACEHOLDER = "ferry terminal (road access unverified)"
# Confirmed terminal/pier features outrank general locality names.
# No generic unnamed pier or untagged endpoint is assigned a name.
PRIORITY = {
    "ferry_terminal": (0, 450),
    "ferry_berth": (1, 350),
    "pier": (2, 350),
    "harbour": (3, 800),
    "port": (3, 800),
    "marina": (4, 550),
    "locality": (5, 1400),
}
CELL = 0.02

def grid_key(point):
    return math.floor(point[0] / CELL), math.floor(point[1] / CELL)

def metres(a, b):
    midlat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * 111320 * math.cos(midlat),
                      (a[1] - b[1]) * 111320)

def real_name(name):
    return (isinstance(name, str) and bool(name.strip())
            and name.strip().casefold() != PLACEHOLDER
            and not name.casefold().startswith("unnamed ferry terminal"))

def extract_name(tags):
    return (tags.get("name:en") or tags.get("int_name")
            or tags.get("name") or "").strip()

def category(tags):
    if tags.get("amenity") == "ferry_terminal":
        return "ferry_terminal"
    if tags.get("seamark:type") == "berth" or tags.get("seamark:berth:category") == "ferry":
        return "ferry_berth"
    if tags.get("man_made") == "pier":
        return "pier"
    if (tags.get("harbour") or tags.get("seamark:type") == "harbour"
            or tags.get("landuse") == "port"):
        return "harbour"
    if tags.get("industrial") == "port" or tags.get("seamark:type") == "harbour":
        return "port"
    if tags.get("leisure") == "marina":
        return "marina"
    if tags.get("place") in {"city", "town", "village", "hamlet", "island", "locality"}:
        return "locality"
    return None

class NearbyNames(osmium.SimpleHandler):
    def __init__(self, ports):
        super().__init__()
        self.ports = ports
        self.bins = collections.defaultdict(list)
        self.candidates = collections.defaultdict(dict)
        self.count = 0
        for p in ports:
            key = grid_key(p["position"])
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    self.bins[key[0] + dx, key[1] + dy].append(p)

    def consider(self, point, name, typ, osm_id):
        if not real_name(name) or typ not in PRIORITY:
            return
        rank, limit = PRIORITY[typ]
        for port in self.bins.get(grid_key(point), ()):
            d = metres(point, port["position"])
            if d > limit:
                continue
            # Port names are matched by geographic proximity, not
            # order of route endpoints or unverified route-name parsing.
            # Rank by feature type first, then distance within that type.
            score = rank * 10000 + d
            found = self.candidates[port["id"]]
            old = found.get(name)
            if old is None or score < old["score"]:
                found[name] = {"name": name, "type": typ, "distance": round(d),
                               "score": score, "osm": osm_id}
                self.count += 1

    def node(self, n):
        typ = category(n.tags)
        if not typ:
            return
        name = extract_name(n.tags)
        if name and n.location.valid():
            self.consider((n.location.lon, n.location.lat), name, typ, f"node/{n.id}")

    def way(self, w):
        typ = category(w.tags)
        if not typ:
            return
        name = extract_name(w.tags)
        if not name:
            return
        # A long ferry terminal/pier polygon can cover a large area.
        # Match its ACTUAL OSM nodes rather than an arbitrary centroid.
        for n in w.nodes:
            if n.location.valid():
                self.consider((n.location.lon, n.location.lat), name, typ, f"way/{w.id}")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pbf", type=Path, required=True)
    parser.add_argument("--network", type=Path, required=True,
                        help="Current ferry GRC.json downloaded from Supabase")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path,
                        help="Optional JSON evidence/report; defaults to output filename + .report.json")
    args = parser.parse_args()
    for file in (args.pbf, args.network):
        if not file.is_file():
            parser.error(f"Missing input: {file}")
    if args.network.resolve() == args.output.resolve():
        parser.error("Use a DIFFERENT output path. Never overwrite the live original.")
    data = json.loads(args.network.read_text(encoding="utf8"))
    if data.get("version") != 1 or not isinstance(data.get("ports"), list) or not isinstance(data.get("routes"), list):
        parser.error("Invalid TravelEmpire ferry network")
    ports = data["ports"]
    for port in ports:
        point = port.get("position")
        if (not isinstance(point, list) or len(point) != 2
                or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in point)):
            parser.error(f"Invalid port position: {port.get('id')}")
    print(f"Scanning {args.pbf} for names near {len(ports)} existing terminals", flush=True)
    handler = NearbyNames(ports)
    handler.apply_file(str(args.pbf), locations=True, idx="flex_mem")
    changes, ambiguous, unresolved = [], [], []
    for port in ports:
        if real_name(port.get("name")):
            continue  # Existing real names take precedence
        candidates = sorted(handler.candidates.get(port["id"], {}).values(),
                            key=lambda c: (c["score"], c["distance"]))
        if not candidates:
            unresolved.append(port["id"])
            continue
        candidate = candidates[0]
        # Two similarly credible, different names mean no safe automatic match.
        competitor = next((c for c in candidates[1:]
                          if c["name"] != candidate["name"]
                          and c["type"] == candidate["type"]
                          and abs(c["distance"] - candidate["distance"]) < 80), None)
        if competitor:
            ambiguous.append({"id": port["id"], "options": [candidate, competitor]})
            continue
        old = port.get("name")
        port["name"] = candidate["name"]
        port["nameSource"] = "OSM " + candidate["osm"]
        port["nameConfidence"] = "high" if candidate["type"] in {"ferry_terminal", "ferry_berth", "pier"} else "review"
        port["nameDistanceMeters"] = candidate["distance"]
        changes.append({"id": port["id"], "previous": old, **candidate})

    # Invariants: no game IDs, connections, coordinates, routes or timetable changes.
    original = json.loads(args.network.read_text(encoding="utf8"))
    for before, after in zip(original["ports"], data["ports"]):
        for key in ("id", "position", "roadAccess"):
            if before.get(key) != after.get(key):
                raise RuntimeError(f"Refusing changed harbour {key}: {before['id']}")
    if original["routes"] != data["routes"]:
        raise RuntimeError("Refusing unexpected ferry route modification")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
    report = args.report or args.output.with_suffix(".report.json")
    report.write_text(json.dumps({
        "ports": len(ports), "routes": len(data["routes"]), "renamed": len(changes),
        "ambiguous": len(ambiguous), "unresolved": len(unresolved),
        "changes": changes, "needsReview": ambiguous, "unresolvedIds": unresolved
    }, ensure_ascii=False, indent=2), encoding="utf8")
    print(f"Named {len(changes)} terminals; ambiguous {len(ambiguous)}; unresolved {len(unresolved)}")
    print(f"Review output: {args.output}\nEvidence report: {report}")
    print("No Supabase objects were modified. Review uncertain locality matches before uploading.")

if __name__ == "__main__":
    main()
