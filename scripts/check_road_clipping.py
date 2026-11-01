#!/usr/bin/env python3
"""Read-only verification that preview road segments lie within a selected ADM3 region."""
import argparse
import json
from pathlib import Path
from shapely.geometry import shape
from shapely.ops import unary_union

parser = argparse.ArgumentParser()
parser.add_argument('--country', default='GRC')
parser.add_argument('--region-id', required=True)
args = parser.parse_args()
regions = json.loads(Path(f'public/data/gadm/{args.country}.geojson').read_text())
selected = [f for f in regions['features'] if f['properties'].get('regionId', f['properties'].get('GID_3')) == args.region_id]
if not selected:
    raise SystemExit(f'No territory with ID {args.region_id}')
territory = unary_union([shape(f['geometry']) for f in selected])
roads = json.loads(Path('public/data/roads/preview.geojson').read_text())
outside = []
invalid = 0
for i, feature in enumerate(roads['features']):
    geom = shape(feature['geometry'])
    if geom.is_empty or not geom.is_valid:
        invalid += 1
        continue
    if not territory.buffer(0.000005).covers(geom):
        outside.append((i, feature.get('properties', {}).get('segmentId', '<no id>')))
print(f'Territory: {args.region_id}')
print(f'Road features: {len(roads["features"]):,}')
print(f'Invalid/empty: {invalid:,}')
print(f'Outside territory: {len(outside):,}')
for index, seg_id in outside[:12]:
    print(f'  Feature {index}: {seg_id}')
if outside:
    raise SystemExit('CHECK FAILED: road preview includes geometry outside selected territory')
print('CHECK PASSED: road preview geometry is inside the selected territory')
