#!/usr/bin/env python3
"""Extract drivable OSM road segments from a local .osm.pbf, clipped to one GADM ADM3 territory."""
import argparse
import json
import math
from pathlib import Path

try:
    import osmium
    from shapely.geometry import shape, Point, LineString, mapping
    from shapely.prepared import prep
except ImportError as exc:
    raise SystemExit('Missing dependency. Run: python3 -m pip install osmium shapely') from exc

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'footway', 'pedestrian', 'path', 'cycleway', 'steps', 'bridleway', 'construction', 'proposed', 'raceway', 'platform', 'corridor', 'via_ferrata'}
ALLOWED = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'road', 'track', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}

def haversine(a, b):
    lon1, lat1 = a
    lon2, lat2 = b
    r = 6371008.8
    dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
    h = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 2*r*math.asin(min(1, math.sqrt(h)))

def lines(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == 'LineString':
        yield geometry
    elif hasattr(geometry, 'geoms'):
        for g in geometry.geoms:
            yield from lines(g)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--country', default='GRC')
    ap.add_argument('--lat', type=float)
    ap.add_argument('--lon', type=float)
    ap.add_argument('--region-id')
    ap.add_argument('--pbf', type=Path)
    ap.add_argument('--output', type=Path, default=ROOT / 'public/data/roads/preview.geojson')
    args = ap.parse_args()
    if not args.region_id and (args.lat is None or args.lon is None):
        ap.error('Supply --region-id or both --lat and --lon')
    pbf = args.pbf or next(iter(sorted((ROOT / 'data/osm').glob('*.osm.pbf'))), None)
    if not pbf or not pbf.exists():
        raise SystemExit('No .osm.pbf found in data/osm/. Supply --pbf PATH.')
    regions_path = ROOT / f'public/data/gadm/{args.country}.geojson'
    if not regions_path.exists():
        raise SystemExit(f'GADM GeoJSON missing: {regions_path}')
    regions = json.loads(regions_path.read_text())['features']
    chosen = None
    point = Point(args.lon, args.lat) if args.lon is not None else None
    for feature in regions:
        props = feature.get('properties') or {}
        rid = props.get('regionId') or props.get('GID_3')
        if args.region_id and rid == args.region_id:
            chosen = feature
            break
        if point and shape(feature['geometry']).covers(point):
            chosen = feature
            break
    if chosen is None:
        raise SystemExit('Territory not found. Check --region-id or coordinates.')
    props = chosen['properties']
    rid = props.get('regionId') or props.get('GID_3')
    name = props.get('regionName') or props.get('NAME_3') or rid
    polygon = shape(chosen['geometry'])
    prepared = prep(polygon)
    minx, miny, maxx, maxy = polygon.bounds
    print(f'Selected: {name} ({rid})', flush=True)
    print(f'Offline source: {pbf}', flush=True)
    print('Scanning local PBF; this may take several minutes for a country extract...', flush=True)
    features = []
    seen = set()
    stats = {'ways': 0, 'segments': 0}

    class RoadHandler(osmium.SimpleHandler):
        def way(self, w):
            highway = w.tags.get('highway')
            if highway not in ALLOWED or highway in EXCLUDED:
                return
            if w.tags.get('area') == 'yes' or w.tags.get('access') in {'no', 'private'} or w.tags.get('motor_vehicle') in {'no', 'private'} or w.tags.get('motorcar') in {'no', 'private'}:
                return
            stats['ways'] += 1
            nodes = list(w.nodes)
            if len(nodes) < 2:
                return
            for a, b in zip(nodes, nodes[1:]):
                try:
                    x1, y1, x2, y2 = a.lon, a.lat, b.lon, b.lat
                except osmium.InvalidLocationError:
                    continue
                if max(x1, x2) < minx or min(x1, x2) > maxx or max(y1, y2) < miny or min(y1, y2) > maxy:
                    continue
                segment = LineString([(x1, y1), (x2, y2)])
                if not prepared.intersects(segment):
                    continue
                clipped = segment.intersection(polygon)
                for i, part in enumerate(lines(clipped)):
                    coords = list(part.coords)
                    if len(coords) < 2:
                        continue
                    length = sum(haversine(a_, b_) for a_, b_ in zip(coords, coords[1:]))
                    if length < 0.05:
                        continue
                    segment_id = f'{rid}:{w.id}:{a.ref}:{b.ref}:{i}'
                    if segment_id in seen:
                        continue
                    seen.add(segment_id)
                    features.append({'type': 'Feature', 'properties': {
                        'segmentId': segment_id, 'regionId': rid, 'osmWayId': str(w.id),
                        'highway': highway, 'roadType': highway, 'lengthMeters': round(length, 2),
                        'explored': False, 'oneway': w.tags.get('oneway', 'no'),
                        'name': w.tags.get('name', '')
                    }, 'geometry': mapping(part)})
                    stats['segments'] += 1

    RoadHandler().apply_file(str(pbf), locations=True, idx='flex_mem')
    output = args.output if args.output.is_absolute() else ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    result = {'type': 'FeatureCollection', 'features': features}
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    total = sum(f['properties']['lengthMeters'] for f in features)
    print(f'Complete: {len(features):,} road segments; {total/1000:,.1f} km inside {rid}', flush=True)
    print(f'Written: {output}', flush=True)
    if not features:
        print('WARNING: no roads found. Confirm the PBF covers the selected territory.')

if __name__ == '__main__':
    main()
