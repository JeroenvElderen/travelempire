#!/usr/bin/env python3
"""One-time conversion from existing .jsonl.gz source archives to borderless 0.1° road tiles.

Usage: python3 scripts/build_geographic_road_tiles.py --input /path/to/old-archives --output /path/to/tiles
Upload output *.jsonl.gz to the public Supabase bucket travelempire-road-tiles.
Copy output/tiles-manifest.json to public/data/roads/tiles-manifest.json.
The legacy archives can then be deleted. They are NOT used by the game.
"""
import argparse,gzip,json,math,collections,tempfile,shutil
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--size',type=float,default=.1);a=p.parse_args()
 if a.size<=0:raise SystemExit('Tile size must be positive')
 a.output.mkdir(parents=True,exist_ok=True)
 archives=sorted(a.input.glob('*.jsonl.gz'))
 if not archives:raise SystemExit('No source .jsonl.gz files found; download your existing archives first')
 temp=Path(tempfile.mkdtemp(prefix='te-tiles-'));counts=collections.Counter();seen=set()
 try:
  for index,archive in enumerate(archives,1):
   with gzip.open(archive,'rt') as source:
    for line in source:
     if not line.strip():continue
     road=json.loads(line);rid=str(road['id'])
     if rid in seen:continue
     seen.add(rid)
     coords=road['coordinates'];lng=(coords[0][0]+coords[1][0])/2;lat=(coords[0][1]+coords[1][1])/2
     name=f'{math.floor(lng/a.size)}_{math.floor(lat/a.size)}';counts[name]+=1
     with (temp/(name+'.jsonl')).open('a') as target:target.write(json.dumps(road,separators=(',',':'))+'\n')
   print(f'Processed {index}/{len(archives)}: {archive.name}',flush=True)
  for name in counts:
   with (temp/(name+'.jsonl')).open('rb') as src,gzip.open(a.output/(name+'.jsonl.gz'),'wb',compresslevel=6) as dst:shutil.copyfileobj(src,dst)
  manifest={'format':'travelempire-road-tiles-v1','tileSize':a.size,'tiles':{k:{'file':k+'.jsonl.gz','edges':v} for k,v in sorted(counts.items())}}
  (a.output/'tiles-manifest.json').write_text(json.dumps(manifest,indent=2))
  print(f'Wrote {len(counts)} tiles containing {len(seen)} unique roads')
 finally:shutil.rmtree(temp)
if __name__=='__main__':main()
