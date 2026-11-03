#!/usr/bin/env python3
"""Incrementally import missing OSM road tiles around ferry terminals, off the game client."""
import gzip
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BASE = URL + "/storage/v1/object/"
ROAD_BUCKET = "travelempire-road-tiles"
FERRY_BUCKET = "travelempire-ferries"
TILE_SIZE = 0.1
MAX_TILES = 6
OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]
HEADERS = {"apikey": KEY, "Authorization": "Bearer " + KEY}

def get(bucket, name):
    # Use authenticated object access for CI. Supabase Storage returns HTTP
    # 400 with a JSON "not_found" code for absent objects on some versions.
    req = urllib.request.Request(BASE + bucket + "/" + name, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(detail)
        except ValueError:
            payload = {}
        code = str(payload.get("code", "")).lower()
        message = str(payload.get("message", "")).lower()
        if error.code == 404 or (error.code == 400 and (
            code in ("not_found", "nosuchkey", "404", "objectnotfound")
            or "not found" in message
            or "does not exist" in message
        )):
            return None
        raise RuntimeError(f"Supabase read {bucket}/{name} HTTP {error.code}: {detail[:300]}") from error

def put(bucket, name, payload, content_type):
    req = urllib.request.Request(
        BASE + bucket + "/" + name, data=payload, method="POST",
        headers={**HEADERS, "Content-Type": content_type, "x-upsert": "true"},
    )
    with urllib.request.urlopen(req, timeout=90) as response:
        response.read()

def metres(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((b[0]-a[0])*111320*math.cos(lat), (b[1]-a[1])*111320)

def fetch_osm(x, y):
    south, west = y*TILE_SIZE, x*TILE_SIZE
    north, east = south+TILE_SIZE, west+TILE_SIZE
    query = ('[out:json][timeout:90];way["highway"~'
             '"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|'
             'service|living_street|track)$"]'
             f'({south},{west},{north},{east});out geom;')
    data = urllib.parse.urlencode({"data": query}).encode()
    for index, endpoint in enumerate(OVERPASS_ENDPOINTS):
        try:
            req = urllib.request.Request(
                endpoint, data=data,
                headers={"User-Agent": "TravelEmpire-RoadTileImporter/1.1"})
            with urllib.request.urlopen(req, timeout=35) as response:
                return json.load(response)["elements"]
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as error:
            print(f"Overpass endpoint {index+1}/{len(OVERPASS_ENDPOINTS)} failed: {error}", flush=True)
    raise RuntimeError("All Overpass endpoints failed; tile will be retried next run")

def build_tile(x, y, ways):
    roads = []
    speed = {"motorway": 110, "trunk": 90, "primary": 70, "secondary": 60,
             "tertiary": 50, "unclassified": 50, "residential": 40,
             "service": 20, "living_street": 15, "track": 20}
    for way in ways:
        tags = way.get("tags", {})
        coords = way.get("geometry", [])
        nodes = way.get("nodes", [])
        if len(coords) != len(nodes):
            continue
        highway = tags.get("highway", "")
        oneway = 1 if tags.get("oneway") in ("yes", "1", "true") else (-1 if tags.get("oneway") == "-1" else 0)
        for i in range(1, len(coords)):
            a = [coords[i-1]["lon"], coords[i-1]["lat"]]
            b = [coords[i]["lon"], coords[i]["lat"]]
            mid = [(a[0]+b[0])/2, (a[1]+b[1])/2]
            if math.floor(mid[0]/TILE_SIZE) != x or math.floor(mid[1]/TILE_SIZE) != y:
                continue
            length = metres(a, b)
            if length <= 0:
                continue
            roads.append({"id": f"osm-{way['id']}-{i-1}", "a": nodes[i-1], "b": nodes[i],
                          "coordinates": [a, b], "length": length, "highway": highway,
                          "speed": speed.get(highway, 40), "oneway": oneway})
    return roads

def main():
    with open("public/data/roads/tiles-manifest.json", encoding="utf-8") as handle:
        bundled = json.load(handle)
    ferry_bytes = get(FERRY_BUCKET, "GRC.json")
    if not ferry_bytes:
        raise RuntimeError("Ferry network GRC.json unavailable")
    network = json.loads(ferry_bytes)
    existing = get(ROAD_BUCKET, "supplemental-manifest.json")
    supplemental = json.loads(existing) if existing else {"format": bundled["format"], "tileSize": TILE_SIZE, "tiles": {}}
    candidates = []
    seen = set()
    for port in network["ports"]:
        point = port.get("roadAccess") or port["position"]
        x, y = math.floor(point[0]/TILE_SIZE), math.floor(point[1]/TILE_SIZE)
        key = f"{x}_{y}"
        if key in seen or key in bundled["tiles"] or key in supplemental["tiles"]:
            continue
        seen.add(key)
        candidates.append((x, y, key))
    print(f"{len(candidates)} ferry-terminal tiles missing from road manifests", flush=True)
    # Recover tile objects uploaded by earlier canceled runs before fetching again.
    uploaded = 0
    def publish():
        put(ROAD_BUCKET, "supplemental-manifest.json",
            json.dumps(supplemental, separators=(",", ":")).encode(), "application/json")
    for x, y, key in candidates[:MAX_TILES]:
        try:
            name = f"{key}.jsonl.gz"
            previous = get(ROAD_BUCKET, name)
            if previous:
                count = len(gzip.decompress(previous).splitlines())
                supplemental["tiles"][key] = {"file": name, "edges": count}
                publish()
                uploaded += 1
                print(f"{key}: recovered {count} segments from previous upload", flush=True)
                continue
            roads = build_tile(x, y, fetch_osm(x, y))
            if not roads:
                print(f"{key}: no drivable OSM roads; leaving absent", flush=True)
                continue
            name = f"{key}.jsonl.gz"
            payload = gzip.compress(("".join(json.dumps(road, separators=(",", ":"))+"\n" for road in roads)).encode())
            put(ROAD_BUCKET, name, payload, "application/gzip")
            supplemental["tiles"][key] = {"file": name, "edges": len(roads)}
            publish()
            uploaded += 1
            print(f"{key}: uploaded {len(roads)} segments", flush=True)
        except Exception as error:
            print(f"{key}: failed: {error}", flush=True)
    publish()
    print(f"Uploaded {uploaded} new tiles; {len(supplemental['tiles'])} supplemental tiles total", flush=True)

if __name__ == "__main__":
    main()
