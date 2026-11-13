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
MAX_TILES = 12
HEADERS = {"apikey": KEY, "Authorization": "Bearer " + KEY}

def get(bucket, name):
    req = urllib.request.Request(BASE + "public/" + bucket + "/" + name)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise

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
    for attempt in range(3):
        try:
            req = urllib.request.Request("https://overpass.kumi.systems/api/interpreter",
                                         data=data, headers={"User-Agent": "TravelEmpire-RoadTileImporter/1.0"})
            with urllib.request.urlopen(req, timeout=110) as response:
                return json.load(response)["elements"]
        except Exception as error:
            if attempt == 2:
                raise
            print(f"Overpass retry {attempt+1}: {error}", flush=True)
            time.sleep(5*(attempt+1))

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
        vertical={}
        try:
            layer=int(tags.get("layer","0"))
            if layer: vertical["layer"]=layer
        except ValueError:
            pass
        try:
            level=float(tags["level"]) if tags.get("level") else None
            if level is not None and math.isfinite(level):
                vertical["level"]=level
        except ValueError:
            pass
        if tags.get("bridge","no").lower() not in ("no","false","0"):
            vertical["bridge"]=True
        if tags.get("tunnel","no").lower() not in ("no","false","0"):
            vertical["tunnel"]=True
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
                          "speed": speed.get(highway, 40), "oneway": oneway, **vertical})
    return roads

def main():
    with open("public/data/roads/tiles-manifest.json", encoding="utf-8") as handle:
        bundled = json.load(handle)
    ferry_bytes = get(FERRY_BUCKET, "GRC.json")
    if not ferry_bytes:
        raise RuntimeError("Ferry network GRC.json unavailable")
    network = json.loads(ferry_bytes)
    existing = get(ROAD_BUCKET, "supplemental-manifest.json")
    supplemental = json.loads(existing) if existing else None
    # Never allow legacy v1 supplements to override the deployed v2 manifest.
    if (supplemental is None or supplemental.get("format")!=bundled["format"]
            or supplemental.get("tileSize")!=bundled["tileSize"]):
        supplemental={"format":bundled["format"],"tileSize":bundled["tileSize"],"tiles":{}}
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
    uploaded = 0
    for x, y, key in candidates[:MAX_TILES]:
        try:
            roads = build_tile(x, y, fetch_osm(x, y))
            if not roads:
                print(f"{key}: no drivable OSM roads; leaving absent", flush=True)
                continue
            name = f"{key}.v2.jsonl.gz" if "v2" in bundled["format"] else f"{key}.jsonl.gz"
            payload = gzip.compress(("".join(json.dumps(road, separators=(",", ":"))+"\n" for road in roads)).encode())
            put(ROAD_BUCKET, name, payload, "application/gzip")
            supplemental["tiles"][key] = {"file": name, "edges": len(roads)}
            uploaded += 1
            print(f"{key}: uploaded {len(roads)} segments", flush=True)
        except Exception as error:
            print(f"{key}: failed: {error}", flush=True)
    put(ROAD_BUCKET, "supplemental-manifest.json",
        json.dumps(supplemental, separators=(",", ":")).encode(), "application/json")
    print(f"Uploaded {uploaded} new tiles; {len(supplemental['tiles'])} supplemental tiles total", flush=True)

if __name__ == "__main__":
    main()
