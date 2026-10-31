#!/usr/bin/env python3
"""Upload TravelEmpire ADM3 road packages to an existing public Supabase Storage bucket.
Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
Never commit or share the service role key.
"""
import json, os, pathlib, sys, time, urllib.request, urllib.error, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent
PROJECT = pathlib.Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else pathlib.Path.cwd()
MANIFEST = PROJECT / 'public/data/roads/manifest.json'
PACKAGES = PROJECT / 'public/data/roads/regions'
BUCKET = 'travelempire-roads'
URL = os.getenv('SUPABASE_URL', '').rstrip('/')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
if not URL.startswith('https://') or not KEY:
    sys.exit('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your terminal first.')
if not MANIFEST.is_file():
    sys.exit(f'Missing manifest: {MANIFEST}')
manifest = json.loads(MANIFEST.read_text())
regions = manifest['regions']
files = sorted({v['file'] for v in regions.values()})
missing = [f for f in files if not (PACKAGES / f).is_file()]
if missing:
    sys.exit(f'{len(missing)} packages missing; first: {missing[:5]}')
print(f'Uploading/checking {len(files)} packages ({sum((PACKAGES/f).stat().st_size for f in files)/1024**2:.1f} MiB)')
headers = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}


def request(url, method='GET', data=None, content_type=None):
    h = dict(headers)
    if content_type: h['Content-Type'] = content_type
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


failures = []
for i, filename in enumerate(files, 1):
    path = PACKAGES / filename
    object_path = urllib.parse.quote(filename, safe='')
    endpoint = f'{URL}/storage/v1/object/{BUCKET}/{object_path}'
    status, _ = request(endpoint, 'HEAD')
    if status == 200:
        print(f'[{i}/{len(files)}] exists  {filename}')
        continue
    if status not in (400, 404):
        failures.append((filename, f'HEAD HTTP {status}'))
        print(f'[{i}/{len(files)}] ERROR  {filename}: HEAD HTTP {status}')
        continue
    for attempt in range(1, 4):
        try:
            status, body = request(endpoint, 'POST', path.read_bytes(), 'application/gzip')
            if status in (200, 201):
                print(f'[{i}/{len(files)}] uploaded {filename}')
                break
            if status == 409:
                print(f'[{i}/{len(files)}] exists  {filename}')
                break
            error = f'HTTP {status}: {body[:250].decode(errors="replace")}'
        except Exception as exc:
            error = str(exc)
        if attempt < 3:
            print(f'[{i}/{len(files)}] retry {attempt}: {error}')
            time.sleep(attempt * 3)
    else:
        failures.append((filename, error))
        print(f'[{i}/{len(files)}] FAILED {filename}: {error}')

print(f'Finished. Total {len(files)}; failed {len(failures)}.')
if failures:
    print('Re-run the same command to retry failed files; uploaded files will be skipped.')
    sys.exit(1)
