#!/usr/bin/env python3
"""Build a nationwide, region-indexed Greek driving-road SQLite database and regional gzip packages."""
import argparse
import gzip
import json
import math
import sqlite3
from pathlib import Path

try:
    import osmium
    from shapely.geometry import shape, LineString, mapping
    from shapely.strtree import STRtree
except ImportError as exc:
    raise SystemExit("Install dependencies: python3 -m pip install osmium shapely") from exc

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {"motorway","motorway_link","trunk","trunk_link","primary","primary_link",
           "secondary","secondary_link","tertiary","tertiary_link","unclassified",
           "residential","living_street","service","road","track"}
DEFAULT_SPEED = {"motorway":110,"motorway_link":60,"trunk":100,"trunk_link":50,
                 "primary":90,"primary_link":40,"secondary":70,"secondary_link":40,
                 "tertiary":50,"tertiary_link":30,"residential":50,"living_street":20,
                 "service":20,"track":15,"road":30,"unclassified":50}
def speed(tags, road):
    raw = str(tags.get("maxspeed", "")).lower().strip()
    try:
        value = float(raw.split()[0])
        if "mph" in raw: value *= 1.609344
        if 5 <= value <= 160: return round(value)
    except (ValueError, IndexError): pass
    return DEFAULT_SPEED.get(road, 50)

def length_m(a, b):
    lon1,lat1=a;lon2,lat2=b
    x=math.radians(lon2-lon1)*math.cos(math.radians((lat1+lat2)/2))
    y=math.radians(lat2-lat1)
    return 6371008.8*math.hypot(x,y)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--pbf",type=Path,default=ROOT/"data/osm/greece-261028.osm.pbf")
    p.add_argument("--regions",type=Path,default=ROOT/"public/data/gadm/GRC.geojson")
    p.add_argument("--database",type=Path,default=ROOT/"data/roads/greece.sqlite")
    p.add_argument("--output",type=Path,default=ROOT/"public/data/roads/regions")
    args=p.parse_args()
    for f in (args.pbf,args.regions):
        if not f.is_file(): raise SystemExit(f"Missing input: {f}")
    regions=json.loads(args.regions.read_text())["features"]
    ids=[]; shapes=[]
    for f in regions:
        rid=f["properties"].get("regionId") or f["properties"].get("GID_3")
        if rid:
            ids.append(rid); shapes.append(shape(f["geometry"]))
    tree=STRtree(shapes)
    args.database.parent.mkdir(parents=True,exist_ok=True)
    args.output.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(args.database)
    db.executescript("""
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    CREATE TABLE IF NOT EXISTS regions(id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS edges(
      id TEXT PRIMARY KEY, way_id INTEGER, from_node INTEGER, to_node INTEGER,
      lng1 REAL,lat1 REAL,lng2 REAL,lat2 REAL,length_m REAL, highway TEXT,
      speed_kmh INTEGER, oneway INTEGER
    );
    CREATE TABLE IF NOT EXISTS region_edges(
      region_id TEXT NOT NULL,edge_id TEXT NOT NULL,
      PRIMARY KEY(region_id,edge_id)
    );
    CREATE INDEX IF NOT EXISTS region_edges_edge ON region_edges(edge_id);
    """)
    # Rebuild tables to avoid mixing data from different PBF/GADM versions.
    db.execute("DELETE FROM region_edges");db.execute("DELETE FROM edges")
    db.execute("DELETE FROM regions")
    db.executemany("INSERT INTO regions VALUES (?,?)",[
        (rid, f["properties"].get("regionName") or f["properties"].get("NAME_3") or rid)
        for rid,f in zip(ids,regions) if rid
    ])
    db.commit()
    stats={"ways":0,"edges":0,"associations":0}
    pending_edges=[];pending_links=[]
    def flush():
        if not pending_edges:return
        db.executemany("INSERT OR IGNORE INTO edges VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",pending_edges)
        db.executemany("INSERT OR IGNORE INTO region_edges VALUES (?,?)",pending_links)
        db.commit()
        pending_edges.clear();pending_links.clear()

    class Handler(osmium.SimpleHandler):
        def way(self,w):
            highway=w.tags.get("highway")
            if highway not in ALLOWED or w.tags.get("area")=="yes":return
            if any(w.tags.get(k) in {"no","private"} for k in ("access","vehicle","motor_vehicle","motorcar")):return
            stats["ways"]+=1
            direction=str(w.tags.get("oneway","")).lower()
            oneway=-1 if direction=="-1" else 1 if direction in ("yes","true","1") or w.tags.get("junction")=="roundabout" else 0
            vmax=speed(w.tags,highway)
            nodes=list(w.nodes)
            for a,b in zip(nodes,nodes[1:]):
                try: aa=(a.lon,a.lat);bb=(b.lon,b.lat)
                except osmium.InvalidLocationError:continue
                if aa==bb:continue
                line=LineString((aa,bb))
                # STRtree returns integer positions in Shapely 2.
                candidates=tree.query(line)
                hits=[ids[int(i)] for i in candidates if shapes[int(i)].intersects(line)]
                if not hits:continue
                edge_id=f"{w.id}:{a.ref}:{b.ref}"
                pending_edges.append((edge_id,w.id,a.ref,b.ref,*aa,*bb,round(length_m(aa,bb),2),highway,vmax,oneway))
                pending_links.extend((rid,edge_id) for rid in hits)
                stats["edges"]+=1;stats["associations"]+=len(hits)
                if len(pending_edges)>=10000:flush()
            if stats["ways"]%100000==0:print(stats,flush=True)
    print(f"Processing {args.pbf} with {len(ids)} ADM3 territories",flush=True)
    Handler().apply_file(str(args.pbf),locations=True,idx="flex_mem")
    flush()
    print("Exporting per-region compressed road packages...",flush=True)
    manifest={"format":"travelempire-road-regions-v1","regions":{}}
    for rid in ids:
        rows=db.execute("""SELECT e.id,e.from_node,e.to_node,e.lng1,e.lat1,e.lng2,e.lat2,
                 e.length_m,e.highway,e.speed_kmh,e.oneway
                 FROM edges e JOIN region_edges r ON r.edge_id=e.id
                 WHERE r.region_id=? ORDER BY e.id""",(rid,))
        # JSONL gzip supports incremental reads without holding all region edges in memory.
        filename=f"{rid}.jsonl.gz"
        count=0
        with gzip.open(args.output/filename,"wt",encoding="utf-8",compresslevel=6) as out:
            for row in rows:
                out.write(json.dumps({"id":row[0],"a":row[1],"b":row[2],
                    "coordinates":[[row[3],row[4]],[row[5],row[6]]],
                    "length":row[7],"highway":row[8],"speed":row[9],"oneway":row[10]},
                    separators=(",",":"))+"\n")
                count+=1
        manifest["regions"][rid]={"file":filename,"edges":count}
    (args.output.parent/"manifest.json").write_text(json.dumps(manifest,indent=2))
    print("Complete:",stats,"Database:",args.database,"Packages:",args.output,flush=True)
    db.close()

if __name__=="__main__":main()
