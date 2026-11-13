#!/usr/bin/env python3
"""Build separate, on-demand walking/cycling road tiles from the Greek OSM PBF.

Example:
  python scripts/build_greece_mobility_tiles.py \
    --pbf data/osm/greece-261028.osm.pbf \
    --output data/greece-mobility-tiles

Does not modify existing car tiles, routes or Supabase. Once uploaded, copy the
resulting tiles-manifest.json to public/data/mobility/tiles-manifest.json, and
deploy that single manifest (only after verifying all uploads).
"""
from __future__ import annotations

import argparse
from collections import Counter, OrderedDict
import gzip
import json
import math
from pathlib import Path
import shutil

try:
    import osmium
except ImportError as error:
    raise SystemExit("Install osmium in the active venv: python -m pip install osmium") from error

from osm_mobility_access import classify, PATHS

TILE_SIZE = 0.1
FORMAT = "travelempire-mobility-v1"
MAX_OPEN = 24


def metres(a, b):
    latitude = math.radians((a[1]+b[1])/2)
    return math.hypot((a[0]-b[0])*111320*math.cos(latitude),
                      (a[1]-b[1])*111320)


class Writer:
    def __init__(self, output):
        self.output=output
        self.spool=output / ".spool"
        self.spool.mkdir(parents=True)
        self.open=OrderedDict()
        self.counts=Counter()
        self.stats=Counter()

    def write(self, tile, item):
        file=self.open.pop(tile, None)
        if file is None:
            if len(self.open)>=MAX_OPEN:
                _,old=self.open.popitem(last=False)
                old.close()
            file=(self.spool / (tile + ".jsonl")).open("a",encoding="utf8")
        self.open[tile]=file
        file.write(json.dumps(item, separators=(",",":"), ensure_ascii=False) + "\n")
        self.counts[tile]+=1
        if item["walk"]!=0:self.stats["walk_segments"]+=1
        if item["cycle"]!=0:self.stats["cycle_segments"]+=1

    def finish(self):
        for file in self.open.values():file.close()
        self.open.clear()
        manifest={"format":FORMAT,"tileSize":TILE_SIZE,"tiles":{}}
        for i,(tile,count) in enumerate(sorted(self.counts.items()),1):
            file=f"mobility_{tile}.v1.jsonl.gz"
            with (self.spool/(tile+".jsonl")).open("rb") as src:
                with gzip.open(self.output/file,"wb",compresslevel=6) as dest:
                    shutil.copyfileobj(src,dest,length=1024*1024)
            (self.spool/(tile+".jsonl")).unlink()
            manifest["tiles"][tile]={"file":file,"edges":count}
            if i%100==0 or i==len(self.counts):
                print(f"Compressed {i}/{len(self.counts)} mobility tiles",flush=True)
        self.spool.rmdir()
        (self.output/"tiles-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
        return manifest


class Extractor(osmium.SimpleHandler):
    def __init__(self, writer, bbox):
        super().__init__()
        self.writer=writer
        self.bbox=bbox
        self.counts=Counter()
        self.examples=[]

    def way(self, way):
        self.counts["ways_scanned"]+=1
        if self.counts["ways_scanned"]%1_000_000==0:
            print(f"Scanned {self.counts['ways_scanned']:,} OSM ways; "
                  f"{self.counts['included_ways']:,} walk/bike corridors",flush=True)
        tags={tag.k:tag.v for tag in way.tags}
        access=classify(tags)
        if not (access.walk or access.cycle):return
        nodes=list(way.nodes)
        if len(nodes)<2:return
        if any(not node.location.valid() for node in nodes):
            self.counts["skipped_ways_with_unlocated_nodes"]+=1
            if len(self.examples)<30:self.examples.append(way.id)
            return
        self.counts["included_ways"]+=1
        highway=tags.get("highway","")
        self.counts["dedicated_ways" if highway in PATHS else "shared_street_ways"]+=1
        vertical={}
        try:
            layer=int(tags.get("layer","0"))
            if layer:vertical["layer"]=layer
        except ValueError:pass
        for k in ("bridge","tunnel"):
            if tags.get(k,"no").lower() not in {"no","false","0"}:
                vertical[k]=True
        for i in range(len(nodes)-1):
            a,b=nodes[i],nodes[i+1]
            start=[a.location.lon,a.location.lat]
            end=[b.location.lon,b.location.lat]
            if start==end:continue
            midpoint=[(start[0]+end[0])/2,(start[1]+end[1])/2]
            if self.bbox and not (
                self.bbox[0]<=midpoint[0]<=self.bbox[2] and
                self.bbox[1]<=midpoint[1]<=self.bbox[3]):continue
            length=metres(start,end)
            if not math.isfinite(length) or length<=0:continue
            tile=f"{math.floor(midpoint[0]/TILE_SIZE)}_{math.floor(midpoint[1]/TILE_SIZE)}"
            # Directed segment representation: 0 = forbidden; 1 = forward;
            # 2 = reverse; 3 = both. Preserve original OSM node IDs so
            # visual grade-separated crossings never become intersections.
            walk=0
            if access.walk:walk=(1 if access.walk_direction>=0 else 0)|(2 if access.walk_direction<=0 else 0)
            cycle=0
            if access.cycle:cycle=(1 if access.cycle_direction>=0 else 0)|(2 if access.cycle_direction<=0 else 0)
            item={
                "id":f"mob-{way.id}-{i}","a":str(a.ref),"b":str(b.ref),
                "coordinates":[start,end],"length":round(length,2),
                "highway":highway,"walk":walk,"cycle":cycle,
                **vertical,
            }
            self.writer.write(tile,item)
            self.counts["segments_written"]+=1


def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pbf",type=Path,default=Path("data/osm/greece-261028.osm.pbf"))
    parser.add_argument("--output",type=Path,default=Path("data/greece-mobility-tiles"))
    parser.add_argument("--bbox",type=float,nargs=4,metavar=("WEST","SOUTH","EAST","NORTH"),
                        help="Optional LOCAL SMOKE TEST only; incomplete Greece network")
    args=parser.parse_args()
    if not args.pbf.is_file():parser.error("PBF not found: "+str(args.pbf))
    if args.output.exists() and any(args.output.iterdir()):
        parser.error("Output already contains data; specify a fresh directory")
    args.output.mkdir(parents=True,exist_ok=True)
    writer=Writer(args.output)
    extractor=Extractor(writer,args.bbox)
    print("Reading OSM mobility ways from",args.pbf,flush=True)
    extractor.apply_file(str(args.pbf),locations=True,idx="flex_mem")
    manifest=writer.finish()
    report={
        "source":str(args.pbf),"format":FORMAT,"tileSize":TILE_SIZE,
        "completeGreece":args.bbox is None,
        "tileCount":len(manifest["tiles"]),
        "segmentCount":sum(entry["edges"] for entry in manifest["tiles"].values()),
        "statistics":dict(extractor.counts),
        "modeStatistics":dict(writer.stats),
        "unlocatedWaySamples":extractor.examples,
        "readyToUpload":args.bbox is None and not extractor.counts["skipped_ways_with_unlocated_nodes"],
    }
    (args.output/"validation.json").write_text(json.dumps(report,indent=2)+"\n")
    print("SUMMARY",json.dumps({
        "tiles":report["tileCount"],"segments":report["segmentCount"],
        "walk_segments":writer.stats["walk_segments"],
        "cycle_segments":writer.stats["cycle_segments"],
        "unlocated_ways":extractor.counts["skipped_ways_with_unlocated_nodes"],
        "readyToUpload":report["readyToUpload"],
    },indent=2),flush=True)
    print("STAGED ONLY: upload data and activate its manifest separately.",flush=True)


if __name__=="__main__":main()
