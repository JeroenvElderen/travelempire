#!/usr/bin/env python3
"""Build a strict car-ferry network from OSM-derived GeoJSON LineString features.

Input features require route=ferry. All ferries carry player vehicles in-game.
The first and last coordinates become provisional terminal locations; a later
road-network integration must verify and snap actual drivable boarding ramps.
No timetable or fare is inferred from the source.
Usage: python3 scripts/build_ferry_network.py input.geojson public/data/ferries/GRC.json
"""
import json
import math
import sys
from pathlib import Path

def truth(value):
    return str(value).lower() in ("yes", "designated")

def parse_duration(value):
    if value is None:
        return None
    try:
        parts = [int(x) for x in str(value).split(":")]
        if len(parts) == 1: return float(parts[0])
        if len(parts) == 2: return parts[0]*60+parts[1]
        if len(parts) == 3: return parts[0]*60+parts[1]+parts[2]/60
    except ValueError:
        return None
    return None

def build(source):
    ports, routes = {}, []
    for index, feature in enumerate(source.get("features", [])):
        tags = feature.get("properties") or {}
        if tags.get("route") != "ferry":
            continue
        geom = feature.get("geometry") or {}
        if geom.get("type") != "LineString": continue
        coords = geom.get("coordinates") or []
        if len(coords)<2 or not all(len(p)>=2 and all(isinstance(v,(int,float)) and math.isfinite(v) for v in p[:2]) and abs(p[0])<=180 and abs(p[1])<=90 for p in coords):continue
        duration = parse_duration(tags.get("duration"))
        if duration is None or duration<=0: continue
        ends=[]
        for p in (coords[0],coords[-1]):
            key=f"{p[0]:.5f},{p[1]:.5f}"
            pid="osm-terminal:"+key
            if pid not in ports:ports[pid]={"id":pid,"name":"Ferry terminal (road access unverified)","position":p[:2]}
            ends.append(pid)
        if ends[0]==ends[1]:continue
        rid=str(tags.get("@id") or tags.get("id") or f"feature-{index}")
        routes.append({"id":"osm-ferry:"+rid,"from":ends[0],"to":ends[1],"geometry":[p[:2] for p in coords],"durationMinutes":duration,"motorVehicle":True,"source":"OpenStreetMap","name":tags.get("name") or tags.get("int_name")})
    return {"version":1,"ports":list(ports.values()),"routes":routes}

def main():
    if len(sys.argv)!=3:raise SystemExit(__doc__)
    src=Path(sys.argv[1]);out=Path(sys.argv[2])
    data=build(json.loads(src.read_text(encoding="utf-8")))
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Imported {len(data['routes'])} confirmed vehicle-ferry routes and {len(data['ports'])} provisional terminals")
if __name__=="__main__":main()
