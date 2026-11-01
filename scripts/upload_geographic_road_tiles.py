#!/usr/bin/env python3
"""Upload TravelEmpire geographic .jsonl.gz tiles to a PUBLIC Supabase Storage bucket.

Required environment: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
Usage: python3 scripts/upload_geographic_road_tiles.py --input data/road-tiles
"""
import argparse
import concurrent.futures
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def request(url, method, key, data=None, timeout=120):
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    if data is not None:
        headers['Content-Type'] = 'application/octet-stream'
        headers['x-upsert'] = 'true'
        headers['Cache-Control'] = 'public, max-age=31536000'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    return urllib.request.urlopen(req, timeout=timeout)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', type=pathlib.Path, default=pathlib.Path('data/road-tiles'))
    p.add_argument('--bucket', default='travelempire-road-tiles')
    p.add_argument('--workers', type=int, default=4)
    p.add_argument('--retries', type=int, default=5)
    args = p.parse_args()
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    if not url.startswith('https://') or not key:
        sys.exit('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your terminal (never commit or share the key).')
    manifest_path = args.input / 'tiles-manifest.json'
    if not manifest_path.is_file():
        sys.exit(f'Missing {manifest_path}')
    manifest = json.loads(manifest_path.read_text())
    names = sorted({entry['file'] for entry in manifest['tiles'].values()})
    missing = [name for name in names if not (args.input / name).is_file()]
    if missing:
        sys.exit(f'Missing {len(missing)} tile files; first: {missing[0]}')
    bucket_url = url + '/storage/v1/bucket/' + urllib.parse.quote(args.bucket, safe='')
    try:
        with request(bucket_url, 'GET', key) as response:
            bucket = json.load(response)
        if not bucket.get('public'):
            sys.exit(f'Bucket {args.bucket} exists but is NOT public. Make it public in Supabase Storage first.')
    except urllib.error.HTTPError as e:
        sys.exit(f'Cannot read bucket {args.bucket} (HTTP {e.code}). Create it as a PUBLIC bucket in Supabase first.')

    def upload(name):
        path = args.input / name
        encoded = urllib.parse.quote(name, safe='')
        object_url = url + '/storage/v1/object/' + urllib.parse.quote(args.bucket, safe='') + '/' + encoded
        # An existing object is considered uploaded; use --fresh after replacing tile data (not needed for first upload).
        for attempt in range(args.retries):
            try:
                with request(object_url, 'HEAD', key, timeout=30) as response:
                    if response.status == 200:
                        return name, 'skipped'
            except urllib.error.HTTPError as e:
                if e.code not in (400, 404):
                    if e.code in (401, 403):
                        return name, f'ERROR: HEAD HTTP {e.code}'
            except (OSError, TimeoutError):
                pass
            try:
                with request(object_url, 'POST', key, data=path.read_bytes(), timeout=180) as response:
                    if response.status in (200, 201):
                        return name, 'uploaded'
            except urllib.error.HTTPError as e:
                if e.code == 409:
                    return name, 'skipped'
                detail = e.read(300).decode('utf-8', 'replace')
                if e.code in (401, 403, 413):
                    return name, f'ERROR: HTTP {e.code} {detail}'
                error = f'HTTP {e.code} {detail}'
            except (OSError, TimeoutError) as e:
                error = str(e)
            time.sleep(min(2 ** attempt, 20))
        return name, 'ERROR: ' + error

    print(f'Uploading/checking {len(names)} geographic tiles to {args.bucket} (workers={args.workers})', flush=True)
    uploaded = skipped = failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 12))) as pool:
        futures = [pool.submit(upload, name) for name in names]
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            name, status = future.result()
            if status == 'uploaded': uploaded += 1
            elif status == 'skipped': skipped += 1
            else: failed += 1
            print(f'[{i}/{len(names)}] {status}: {name}', flush=True)
    print(f'Finished. Uploaded {uploaded}; already present {skipped}; failed {failed}.', flush=True)
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
