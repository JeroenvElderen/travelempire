#!/usr/bin/env python3
"""Upload offline rest POI tiles to public Supabase Storage.

Environment variables:
 SUPABASE_URL=https://<project>.supabase.co
 SUPABASE_SERVICE_ROLE_KEY=<secret service-role key>
Usage: python3 scripts/upload_rest_stops.py
Requires: pip install requests
"""
import os
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests

ROOT = Path("public/data/rest-stops")
BUCKET = "travelempire-rest-stops"


def main():
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    secret = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base.startswith("https://") or not secret:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.")
    if not (ROOT / "manifest.json").is_file():
        sys.exit(f"Missing {ROOT / 'manifest.json'}; generate tiles first.")
    files = sorted((ROOT / "tiles").glob("*.json"))
    if not files:
        sys.exit("No rest-stop tiles found.")
    # Publish manifest last so the client cannot discover tiles that are not uploaded yet.
    files.append(ROOT / "manifest.json")
    session = requests.Session()
    session.headers.update({"apikey": secret, "Authorization": "Bearer " + secret})
    total = len(files)
    failed = []
    print(f"Uploading {total} JSON files to {BUCKET}...")
    for index, file in enumerate(files, 1):
        object_path = file.relative_to(ROOT).as_posix()
        url = f"{base}/storage/v1/object/{BUCKET}/{quote(object_path, safe='/')}"
        ok = False
        for attempt in range(4):
            try:
                with file.open("rb") as body:
                    response = session.post(url, data=body, headers={
                        "Content-Type": "application/json",
                        "Cache-Control": "3600",
                        "x-upsert": "true",
                    }, timeout=45)
                if response.status_code in (200, 201):
                    ok = True
                    break
                if response.status_code in (401, 403):
                    sys.exit(f"Permission denied ({response.status_code}): check bucket and key. {response.text[:250]}")
                if response.status_code not in (408, 429, 500, 502, 503, 504):
                    break
            except requests.RequestException as error:
                response = None
                last_error = str(error)
            time.sleep(min(2 ** attempt, 8))
        if not ok:
            failed.append(object_path)
            detail = response.text[:180] if response is not None else last_error
            print(f"FAILED {object_path}: {detail}")
        if index % 50 == 0 or index == total:
            print(f"{index}/{total} processed · {len(failed)} failed", flush=True)
    if failed:
        print(f"Upload incomplete: {len(failed)} failed. Rerun to retry.")
        sys.exit(1)
    print("All rest POI tiles and manifest uploaded successfully.")


if __name__ == "__main__":
    main()
