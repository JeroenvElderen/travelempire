#!/usr/bin/env python3
"""Upload generated station JSON tiles to a PUBLIC Supabase Storage bucket.

Usage:
  SUPABASE_URL=https://PROJECT.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \\
    python3 scripts/upload_station_tiles.py

Never commit or expose the service-role key in VITE_ variables.
Create public bucket 'travelempire-stations' in Supabase Storage first.
"""
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1] / 'public/data/stations'
manifest_path = root / 'manifest.json'
if not manifest_path.exists():
    sys.exit(f'Missing {manifest_path}; run build_station_tiles.py first')
manifest = json.loads(manifest_path.read_text())
keys = manifest.get('tiles', [])
if not keys:
    sys.exit('Station manifest has no tiles; refusing empty upload')
url = os.getenv('SUPABASE_URL', '').rstrip('/')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
if not url.startswith('https://') or not key:
    sys.exit('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your terminal (never in VITE_ variables)')
base = f'{url}/storage/v1/object/travelempire-stations/'
headers = {'Authorization': f'Bearer {key}', 'apikey': key,
           'Content-Type': 'application/json', 'x-upsert': 'true'}
for idx, tile in enumerate(keys, 1):
    path = root / 'tiles' / f'{tile}.json'
    if not path.is_file():
        sys.exit(f'Missing tile {path}')
    data = path.read_bytes()
    request = Request(base + quote(f'tiles/{tile}.json', safe='/'), data=data,
                      headers=headers, method='POST')
    for attempt in range(5):
        try:
            with urlopen(request, timeout=45) as response:
                if not 200 <= response.status < 300:
                    raise RuntimeError(f'HTTP {response.status}')
            break
        except (HTTPError, URLError, TimeoutError) as error:
            if attempt == 4:
                sys.exit(f'Upload failed on {tile}: {error}')
            time.sleep(2 ** attempt)
    if idx % 100 == 0 or idx == len(keys):
        print(f'Uploaded {idx}/{len(keys)} tiles', flush=True)
print('Done. Keep public/data/stations/manifest.json in Git, not the tile JSON files.')
