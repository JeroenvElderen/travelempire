#!/usr/bin/env python3
"""Review-safe Supabase upload for an enriched TravelEmpire GRC.json.

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as LOCAL environment vars.
Downloads the live file, verifies that ALL route, geometry and port IDs match,
writes a local backup, and uploads ONLY corrected harbour names.
Never put the service role key in a frontend VITE_* variable or GitHub repo.

  python scripts/upload_enriched_ferry_network.py \
    --input data/GRC-named.json --backup data/GRC-before-names.json
"""
import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

BUCKET="travelempire-ferries"
OBJECT="GRC.json"

def fetch_current(base):
    with urllib.request.urlopen(
        urllib.request.Request(f"{base}/object/public/{BUCKET}/{OBJECT}",
                               headers={"User-Agent":"TravelEmpireHarbourNameReview/1"}),
        timeout=40) as response:
        return json.load(response)

def signature(port):
    return tuple(port.get(k) if k!="position" else tuple(port["position"])
                 for k in ("id","position"))

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input",required=True,type=Path)
    ap.add_argument("--backup",required=True,type=Path)
    ap.add_argument("--confirm",action="store_true",
                    help="Required to perform upload; absent means dry run.")
    args=ap.parse_args()
    url=os.getenv("SUPABASE_URL","").rstrip("/")
    key=os.getenv("SUPABASE_SERVICE_ROLE_KEY","")
    if not url.startswith("https://"):
        ap.error("SUPABASE_URL must be an HTTPS project URL")
    if args.confirm and not key:
        ap.error("Set SUPABASE_SERVICE_ROLE_KEY locally before upload")
    if args.input.resolve()==args.backup.resolve():
        ap.error("Backup must not overwrite the enriched input")
    staged=json.loads(args.input.read_text(encoding="utf8"))
    base=url+"/storage/v1"
    current=fetch_current(base)
    if staged.get("version")!=1 or current.get("version")!=1:
        ap.error("Unexpected ferry network format")
    # Route equality is mandatory: even a fresh weekly import can move IDs,
    # split routes or alter geometry. Do not clobber anything but names.
    if staged.get("routes")!=current.get("routes"):
        ap.error("Remote routes have changed since enrichment; download the new GRC.json and regenerate.")
    old_ports={p["id"]:p for p in current.get("ports",[])}
    new_ports={p["id"]:p for p in staged.get("ports",[])}
    if old_ports.keys()!=new_ports.keys():
        ap.error("Port IDs differ from live data; refusing update")
    allowed={"name","nameSource","nameConfidence","nameDistanceMeters"}
    for id,old in old_ports.items():
        new=new_ports[id]
        if signature(old)!=signature(new):
            ap.error("Port coordinates differ for "+id)
        for field in set(old)|set(new):
            if field not in allowed and old.get(field)!=new.get(field):
                ap.error("Unexpected field change "+field+" in "+id)
    changes=[p for p in staged["ports"] if p.get("name")!=old_ports[p["id"]].get("name")]
    args.backup.parent.mkdir(parents=True,exist_ok=True)
    args.backup.write_text(json.dumps(current,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(f"Remote backup: {args.backup}")
    print(f"Verified {len(old_ports)} port IDs and {len(staged['routes'])} unchanged routes")
    print(f"Names changed: {len(changes)}")
    if not changes:
        print("Nothing to upload.")
        return
    if not args.confirm:
        print("DRY RUN ONLY. Review the generated report, then rerun with --confirm.")
        return
    headers={"Authorization":"Bearer "+key,"apikey":key,"Content-Type":"application/json",
             "x-upsert":"true","User-Agent":"TravelEmpireHarbourNameReview/1"}
    data=json.dumps(staged,ensure_ascii=False,separators=(",",":")).encode("utf8")
    req=urllib.request.Request(f"{base}/object/{BUCKET}/{OBJECT}",
                               data=data,headers=headers,method="POST")
    try:
        with urllib.request.urlopen(req,timeout=90) as result:
            if result.status not in (200,201):
                raise RuntimeError("Unexpected Supabase status "+str(result.status))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Upload rejected (HTTP {exc.code}): "
                           +exc.read(600).decode("utf8","replace")) from exc
    print(f"Uploaded {len(changes)} corrected names to {BUCKET}/{OBJECT}.")
    print("In TravelEmpire open Ferries → Refresh data.")

if __name__=="__main__":
    main()
