#!/usr/bin/env python3
"""Download the exact currently deployed Greek routing tiles for safe offline enrichment.

No credentials needed: TravelEmpire's road bucket is public.
The bundled tile manifest is combined with any supplemental-manifest.json just
as the browser does. Existing completed downloads are resumed.

  python scripts/download_live_road_tiles.py --output data/road-tiles-current

Environment: SUPABASE_URL=https://<project>.supabase.co
"""
import argparse
import concurrent.futures
import gzip
import json
import os
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BUCKET = "travelempire-road-tiles"

def request(url, timeout=60):
    return urllib.request.urlopen(urllib.request.Request(url, headers={
        "User-Agent": "TravelEmpireRoadTileBackup/1"}), timeout=timeout)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--manifest",type=Path,default=Path("public/data/roads/tiles-manifest.json"))
    parser.add_argument("--workers",type=int,default=3)
    args=parser.parse_args()
    supabase=os.getenv("SUPABASE_URL","").rstrip("/")
    if not supabase.startswith("https://"):
        parser.error("Set SUPABASE_URL to your Supabase project HTTPS URL")
    if not args.manifest.is_file():
        parser.error("Run this from the TravelEmpire repo root (missing bundled manifest)")
    manifest=json.loads(args.manifest.read_text(encoding="utf8"))
    if manifest.get("tileSize") is None or not isinstance(manifest.get("tiles"),dict):
        parser.error("Invalid bundled manifest")
    public=supabase+"/storage/v1/object/public/"+BUCKET
    supplemental_url=public+"/supplemental-manifest.json"
    try:
        with request(supplemental_url) as response:
            supplemental=json.load(response)
        if supplemental.get("tileSize")!=manifest["tileSize"]:
            parser.error("Supplemental tile size differs; inspect the live deployment")
        manifest["tiles"].update(supplemental.get("tiles") or {})
        print(f"Merged {len(supplemental.get('tiles') or {})} supplemental tile entries.")
    except urllib.error.HTTPError as e:
        if e.code!=404:
            raise
        print("No supplemental manifest; using bundled tile manifest.")
    out=args.output
    out.mkdir(parents=True,exist_ok=True)
    filenames=sorted({entry["file"] for entry in manifest["tiles"].values()})
    if not filenames:
        parser.error("No road tile files in merged manifest")
    print(f"Backing up {len(filenames)} compressed road tiles to {out}...",flush=True)

    def download(name):
        if "/" in name or "\\" in name or name.startswith("."):
            raise RuntimeError("Unexpected tile file name: "+name)
        path=out/name
        if path.is_file() and path.stat().st_size>20:
            with path.open("rb") as data:
                if data.read(2)==b"\x1f\x8b":
                    return "cached", name
        url=public+"/"+urllib.parse.quote(name,safe="")
        for attempt in range(4):
            temp=out/(name+".partial")
            try:
                with request(url,timeout=150) as src,temp.open("wb") as dst:
                    shutil.copyfileobj(src,dst,1024*1024)
                with gzip.open(temp,"rb") as packed:
                    packed.read(64)  # quickly reject truncated headers
                temp.replace(path)
                return "downloaded",name
            except Exception:
                temp.unlink(missing_ok=True)
                if attempt==3:
                    raise
                time.sleep(2**attempt)
        raise RuntimeError("Retry exhausted")
    failed=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(6,args.workers))) as pool:
        jobs={pool.submit(download,name):name for name in filenames}
        for i,future in enumerate(concurrent.futures.as_completed(jobs),1):
            try:
                status,name=future.result()
                if i%20==0 or i==len(filenames):
                    print(f"[{i}/{len(filenames)}] {status} {name}",flush=True)
            except Exception as e:
                failed.append((jobs[future],str(e)))
                print("FAILED:",jobs[future],e,flush=True)
    if failed:
        raise SystemExit(f"{len(failed)} tiles failed. Rerun the same command to resume; no manifest written.")
    (out/"tiles-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf8")
    print(f"Complete: {len(filenames)} tiles. Manifest: {out/'tiles-manifest.json'}")

if __name__=="__main__":
    main()
