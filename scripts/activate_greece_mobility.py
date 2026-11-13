#!/usr/bin/env python3
"""Verify deployed mobility tiles before activating the separate client manifest.

No Supabase writes. --confirm copies the complete staged manifest only after
the public compressed tile objects can all be retrieved with expected lengths.
The taxi road manifest and taxi graph are never touched.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import sys
import urllib.parse
import urllib.request


def verify(base: str, filename: str, local: Path) -> None:
    url=(base.rstrip("/")+"/storage/v1/object/public/travelempire-road-tiles/"
         +urllib.parse.quote(filename,safe=""))
    req=urllib.request.Request(url,method="HEAD",
      headers={"User-Agent":"TravelEmpire-Mobility-Deployment-Validator/1"})
    with urllib.request.urlopen(req,timeout=60) as response:
        if response.status!=200:raise RuntimeError("HTTP "+str(response.status)+" for "+filename)
        remote_length=response.headers.get("Content-Length")
        if remote_length and int(remote_length)!=local.stat().st_size:
            raise RuntimeError("Unexpected remote size for "+filename)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input",type=Path,default=Path("data/greece-mobility-tiles"))
    p.add_argument("--manifest",type=Path,default=Path("public/data/mobility/tiles-manifest.json"))
    p.add_argument("--supabase-url",default=os.environ.get("SUPABASE_URL",""))
    p.add_argument("--confirm",action="store_true")
    args=p.parse_args()
    report=json.loads((args.input/"validation.json").read_text())
    staged=json.loads((args.input/"tiles-manifest.json").read_text())
    if not report["readyToUpload"] or not report["completeGreece"]:
        sys.exit("Full Greece mobility audit failed/incomplete; do not activate")
    if staged.get("format")!="travelempire-mobility-v1" or staged.get("tileSize")!=0.1:
        sys.exit("Unsupported mobility manifest")
    tiles=staged.get("tiles",{})
    if len(tiles)!=report["tileCount"] or not tiles:
        sys.exit("Tile count mismatch / no geographic mobility tiles")
    if not args.supabase_url.startswith("https://"):
        sys.exit("Set SUPABASE_URL to verify your public road storage objects")
    if args.manifest.exists():
        existing=json.loads(args.manifest.read_text())
        if existing.get("format")!=staged["format"] or existing.get("tileSize")!=staged["tileSize"]:
            sys.exit("Existing mobility manifest uses another dataset version")
    print("Checking",len(tiles),"mobility tiles in Supabase…",flush=True)
    for i,info in enumerate(tiles.values(),1):
        filename=info["file"]
        local=args.input/filename
        if not local.is_file():sys.exit("Missing local tile "+filename)
        verify(args.supabase_url,filename,local)
        if i%100==0 or i==len(tiles):print("Verified",i,"/",len(tiles),flush=True)
    if args.confirm:
        args.manifest.parent.mkdir(parents=True,exist_ok=True)
        temporary=args.manifest.with_suffix(".json.tmp")
        shutil.copyfile(args.input/"tiles-manifest.json",temporary)
        temporary.replace(args.manifest)
        print("Mobility manifest activated locally. Commit/push only this mobility manifest.")
    else:
        print("DRY RUN: all uploaded objects accessible; rerun with --confirm.")


if __name__=="__main__":
    main()
