#!/usr/bin/env python3
"""Extract Greek OSM fuel, EV charging and car-repair POIs into 0.1° JSON cells.

Install: python3 -m pip install osmium
Run: python3 scripts/build_station_tiles.py /path/to/greece-latest.osm.pbf
Output: public/data/stations/manifest.json and tiles/*.json

OSM nodes and ways are supported. For ways, a mean coordinate of available
vertices is used. Relations are omitted (uncommon for these POI types).
"""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

try:
 import osmium
except ImportError as exc:
 raise SystemExit('Missing dependency: python3 -m pip install osmium') from exc

class Extractor(osmium.SimpleHandler):
 def __init__(self):
  super().__init__()
  self.tiles=defaultdict(list)
  self.seen=set()
 def collect(self,kind,osm_id,tags,lon,lat):
  if not (math.isfinite(lon) and math.isfinite(lat)):
   return
  amenity=tags.get('amenity',''); shop=tags.get('shop','')
  category='fuel' if amenity=='fuel' else 'charging' if amenity=='charging_station' else 'workshop' if shop=='car_repair' else None
  if not category:return
  key=f'{math.floor(lon*10)}_{math.floor(lat*10)}'
  ident=f'{kind}/{osm_id}'
  if ident in self.seen:return
  self.seen.add(ident)
  station={'id':ident,'kind':category,'lng':round(lon,7),'lat':round(lat,7),'name':tags.get('name') or tags.get('brand') or {'fuel':'Fuel station','charging':'EV charging station','workshop':'Vehicle workshop'}[category]}
  for tag in ('operator','access'):
   if tags.get(tag):station[tag]=tags[tag]
  self.tiles[key].append(station)
 def node(self,n):
  if n.location.valid():self.collect('node',n.id,n.tags,n.location.lon,n.location.lat)
 def way(self,w):
  if w.tags.get('amenity') not in ('fuel','charging_station') and w.tags.get('shop')!='car_repair':return
  coords=[(n.location.lon,n.location.lat) for n in w.nodes if n.location.valid()]
  if coords:self.collect('way',w.id,w.tags,sum(x for x,y in coords)/len(coords),sum(y for x,y in coords)/len(coords))

p=argparse.ArgumentParser();p.add_argument('pbf',type=Path);p.add_argument('--output',type=Path,default=Path('public/data/stations'));args=p.parse_args()
if not args.pbf.is_file():raise SystemExit(f'OSM PBF not found: {args.pbf}')
extractor=Extractor();extractor.apply_file(str(args.pbf),locations=True)
tiles=args.output/'tiles';tiles.mkdir(parents=True,exist_ok=True)
for old in tiles.glob('*.json'):old.unlink()
for key,items in extractor.tiles.items():
 (tiles/f'{key}.json').write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')))
manifest={'version':1,'source':'OpenStreetMap extract','tileDegrees':0.1,'tiles':sorted(extractor.tiles),'count':sum(map(len,extractor.tiles.values()))}
(args.output/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(f"Wrote {manifest['count']} locations in {len(extractor.tiles)} tiles to {args.output}")
