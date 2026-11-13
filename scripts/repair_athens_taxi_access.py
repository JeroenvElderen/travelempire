#!/usr/bin/env python3
"""Stage the missing taxi-authorized Athens Airport exit using a local Greece PBF.

Node 3343921312 currently has one inbound segment and zero outgoing in the
TravelEmpire public network. OSM way 157772015 is oneway=yes, access=no,
taxi=yes, bus=yes; it is the missing legal taxi exit. A separate private road
307919252 must NOT be included.

This script changes no live data. It creates:
 - <output>/239_379.taxi-access.v2.jsonl.gz     new single-road tile
 - <output>/tiles-manifest.json                 one-entry upload manifest
 - <output>/activate-manifest.json              full staged game manifest
 - <output>/validation.json                     audit report and invariants

Run from the TravelEmpire repo root:
 python scripts/repair_athens_taxi_access.py \
   --pbf data/osm/greece-261028.osm.pbf \
   --output data/athens-taxi-access

Requires: pip install osmium. Upload new named tile BEFORE activating manifest.
"""
import argparse
import gzip
import json
import math
import os
from pathlib import Path
import urllib.request
import osmium

NODE=3343921312
OSM_WAY=157772015
PRIVATE_WAY=307919252
TILE="239_379"
OLD_FILENAME=TILE+".v2.jsonl.gz"
NEW_FILENAME=TILE+".taxi-access.v2.jsonl.gz"
BUCKET="travelempire-road-tiles"
SPEED=20

def length_metres(a,b):
    mid=math.radians((a[1]+b[1])/2)
    return math.hypot((a[0]-b[0])*111320*math.cos(mid),(a[1]-b[1])*111320)

class FerryAccessWay(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.tags=None
        self.nodes=None

    def way(self,way):
        if way.id!=OSM_WAY:return
        self.tags={str(k):str(v) for k,v in way.tags}
        self.nodes=[]
        for node in way.nodes:
            if not node.location.valid():
                raise RuntimeError("Selected OSM way has a node with missing coordinates")
            self.nodes.append((node.ref,[node.location.lon,node.location.lat]))

def read_remote(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={
        "User-Agent":"TravelEmpireAirportTaxiAccessRepair/1"}),timeout=90) as response:
        return response.read()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pbf",type=Path,default=Path("data/osm/greece-261028.osm.pbf"))
    p.add_argument("--output",type=Path,default=Path("data/athens-taxi-access"))
    p.add_argument("--manifest",type=Path,default=Path("public/data/roads/tiles-manifest.json"))
    p.add_argument("--source",type=Path,
                   default=Path("data/road-tiles-v2")/OLD_FILENAME,
                   help="Existing local v2 tile; downloads public Supabase copy if absent")
    args=p.parse_args()
    for item in (args.pbf,args.manifest):
        if not item.is_file():p.error("Missing input: "+str(item))
    if args.output.resolve() in (args.source.resolve(),args.manifest.resolve()):
        p.error("Output must be separate from input")
    manifest=json.loads(args.manifest.read_text(encoding="utf8"))
    entry=manifest.get("tiles",{}).get(TILE)
    if manifest.get("format")!="travelempire-road-tiles-v2-levels" or entry is None:
        p.error("Expected active v2 manifest and Athens 239_379 tile")
    if entry["file"]!=OLD_FILENAME:
        p.error("Athens tile name already changed; do not overwrite an earlier patch")
    if args.source.is_file():
        packed=args.source.read_bytes()
        source=str(args.source)
    else:
        url=os.getenv("SUPABASE_URL","").rstrip("/")
        if not url.startswith("https://"):
            p.error("Set SUPABASE_URL to download the current tile")
        source=url+"/storage/v1/object/public/"+BUCKET+"/"+OLD_FILENAME
        packed=read_remote(source)
    original=[json.loads(line) for line in gzip.decompress(packed).splitlines() if line.strip()]
    original_ids={r["id"] for r in original}
    if len(original_ids)!=len(original):
        p.error("Source tile has duplicate road IDs")
    incoming=[r for r in original if str(r.get("b"))==str(NODE)
              and r.get("oneway")==1]
    outgoing=[r for r in original if
              (str(r.get("a"))==str(NODE) and r.get("oneway")!=-1)
              or (str(r.get("b"))==str(NODE) and r.get("oneway")!=1)]
    if not any(r["id"].startswith("osm-157768344-") for r in incoming):
        p.error("Known inbound edge missing; check tile version before repairing")
    if outgoing:
        p.error("Node already has outgoing roads in this tile; refusing duplicate repair")

    osm=FerryAccessWay()
    print("Reading local PBF for taxi-permitted OSM way "+str(OSM_WAY),flush=True)
    osm.apply_file(str(args.pbf),locations=True,idx="flex_mem")
    if not osm.nodes:
        p.error("Way missing from your local PBF; no files generated")
    tags=osm.tags
    if tags.get("highway")!="service" or tags.get("oneway") not in {"yes","1","true"}:
        p.error("Unexpected OSM way type/direction; review manually")
    if tags.get("taxi") not in {"yes","designated","permissive"}:
        p.error("Local PBF does not explicitly allow taxis; no bypass of access restriction")
    if tags.get("access") not in {"no","private"}:
        p.error("General access restrictions changed; review manually")
    if osm.nodes[0][0]!=NODE:
        p.error("Expected this OSM way to start at the trapped node")
    additions=[]
    out_of_tile=0
    for i,((aid,a),(bid,b)) in enumerate(zip(osm.nodes,osm.nodes[1:])):
        if a==b:continue
        mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2
        tile=f"{math.floor(mx/0.1)}_{math.floor(my/0.1)}"
        if tile!=TILE:
            out_of_tile+=1
            continue
        item={"id":f"osm-{OSM_WAY}-{i}","a":aid,"b":bid,
              "coordinates":[a,b],"length":length_metres(a,b),
              "highway":"service","speed":SPEED,"oneway":1,
              "taxiOnly":True}
        if tags.get("layer","0")!="0":item["layer"]=int(tags["layer"])
        if tags.get("bridge","no") not in {"no","0","false"}:item["bridge"]=True
        if tags.get("tunnel","no") not in {"no","0","false"}:item["tunnel"]=True
        additions.append(item)
    if out_of_tile:
        p.error(f"{out_of_tile} sections leave tile {TILE}; patch must cover every affected tile")
    if not additions or str(additions[0]["a"])!=str(NODE):
        p.error("No valid outward taxi road found")
    if any(r["id"] in original_ids for r in additions):
        p.error("Existing edge ID collision")
    if any(str(r["a"])==str(NODE) for r in original if r.get("taxiOnly")):
        p.error("Taxi exit already present")
    patched=original+additions
    ids={r["id"] for r in patched}
    if len(ids)!=len(patched):
        p.error("Duplicate IDs after patch")
    # Never delete or rewrite existing road segments, explored IDs or positions.
    if patched[:len(original)]!=original:
        raise RuntimeError("Unexpected mutation to original tile")
    args.output.mkdir(parents=True,exist_ok=True)
    payload=b"".join(json.dumps(r,separators=(",",":")).encode()+b"\n" for r in patched)
    newpath=args.output/NEW_FILENAME
    newpath.write_bytes(gzip.compress(payload,compresslevel=6,mtime=0))
    activated=json.loads(args.manifest.read_text(encoding="utf8"))
    activated["tiles"][TILE]={"file":NEW_FILENAME,"edges":len(patched)}
    (args.output/"activate-manifest.json").write_text(json.dumps(activated,indent=2)+"\n")
    upload_manifest={"format":manifest["format"],"tileSize":manifest["tileSize"],
                     "tiles":{TILE:activated["tiles"][TILE]}}
    (args.output/"tiles-manifest.json").write_text(json.dumps(upload_manifest,indent=2)+"\n")
    report={"node":NODE,"taxiAuthorizedOSMWay":OSM_WAY,
            "excludedPrivateOSMWay":PRIVATE_WAY,
            "originalRoadSegments":len(original),"newTaxiOnlySegments":len(additions),
            "resultRoadSegments":len(patched),
            "incomingBefore":len(incoming),"outgoingBefore":len(outgoing),
            "outgoingAfter":1,
            "firstAddedEdge":additions[0]["id"],"lastAddedEdge":additions[-1]["id"],
            "source":source,"osmTags":tags,
            "inputIDsPreserved":True,"readyToUpload":True}
    (args.output/"validation.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2),flush=True)
    print("STAGED ONLY. No Supabase files or Git manifests changed.")

if __name__=="__main__":main()
