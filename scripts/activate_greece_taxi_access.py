#!/usr/bin/env python3
"""Validate uploaded, immutable nationwide taxi-access tiles before manifest activation.

Default is DRY RUN. Pass --confirm only after upload_geographic_road_tiles.py
has reported failed 0. This script never uploads or overwrites Supabase data.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import urllib.parse
import urllib.request

BUCKET = "travelempire-road-tiles"


def checked_public_object(base, filename, local_file):
    path = (base.rstrip("/") + "/storage/v1/object/public/" + BUCKET + "/"
            + urllib.parse.quote(filename, safe=""))
    req = urllib.request.Request(
        path, method="HEAD",
        headers={"User-Agent": "TravelEmpire-Taxi-Audit-Manifest-Activation/1"})
    with urllib.request.urlopen(req, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"Remote object not accessible: {filename} HTTP {response.status}")
        actual = response.headers.get("Content-Length")
        if actual is not None and int(actual) != local_file.stat().st_size:
            raise RuntimeError(f"Remote size differs for {filename}: {actual} vs {local_file.stat().st_size}")
    return True


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, default=Path("data/greece-taxi-audit"))
    p.add_argument("--manifest", type=Path, default=Path("public/data/roads/tiles-manifest.json"))
    p.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL", ""))
    p.add_argument("--confirm", action="store_true", help="Replace local bundled manifest AFTER verification")
    args = p.parse_args()
    report = json.loads((args.input / "validation.json").read_text(encoding="utf8"))
    tiles = json.loads((args.input / "tiles-manifest.json").read_text(encoding="utf8"))["tiles"]
    activated = json.loads((args.input / "activate-manifest.json").read_text(encoding="utf8"))
    if not report.get("readyForActivation"):
        sys.exit("Audit not complete (missing tiles or OSM coordinates). Do not activate.")
    if not tiles:
        sys.exit("No changed tiles staged; nothing to activate")
    existing_bytes = args.manifest.read_bytes()
    if hashlib.sha256(existing_bytes).hexdigest() != report["originalManifestSha256"]:
        sys.exit("Game manifest changed since audit. Re-run the audit using the latest manifest.")
    existing = json.loads(existing_bytes)
    expected = json.loads(existing_bytes)
    expected["tiles"].update(tiles)
    if expected != activated:
        sys.exit("Staged activation manifest differs from expected tile replacements")
    if not args.supabase_url.startswith("https://"):
        sys.exit("Set SUPABASE_URL to verify public Supabase objects before activating")
    print(f"Checking {len(tiles)} immutable uploaded road tiles...", flush=True)
    for index, entry in enumerate(sorted(tiles.values(), key=lambda e: e["file"]), 1):
        name = entry["file"]
        local = args.input / name
        if not local.is_file():
            sys.exit("Missing staged tile: " + name)
        checked_public_object(args.supabase_url, name, local)
        if index % 20 == 0 or index == len(tiles):
            print(f"Verified {index}/{len(tiles)}", flush=True)
    if args.confirm:
        # Commit/push separately so Cloudflare loads only a fully-uploaded manifest.
        shutil.copyfile(args.input / "activate-manifest.json", args.manifest)
        print("Local manifest updated; commit and push it to activate the new roads.")
    else:
        print("DRY RUN ONLY. All uploads visible; rerun with --confirm to switch local manifest.")


if __name__ == "__main__":
    main()
