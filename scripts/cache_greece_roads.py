#!/usr/bin/env python3
"""One-time Greece PBF -> 0.1 degree gzip road tiles -> resumable Supabase manifest."""
import argparse,gzip,hashlib,json,math,os,random,sqlite3,time,urllib.request,urllib.error
from pathlib import Path
import osmium
BUCKET="travelempire-road-tiles"
ALLOWED={"motorway","motorway_link","trunk","trunk_link","primary","primary_link","secondary","secondary_link","tertiary","tertiary_link","unclassified","residential","living_street","service","road","track"}
SPEED={"motorway":110,"motorway_link":60,"trunk":100,"trunk_link":50,"primary":90,"primary_link":40,"secondary":70,"secondary_link":40,"tertiary":50,"tertiary_link":30,"unclassified":50,"residential":50,"living_street":20,"service":20,"road":30,"track":15}
def storage(name,data=None,kind="application/json"):
    key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    url=os.environ["SUPABASE_URL"].rstrip("/")+"/storage/v1/object/"+BUCKET+"/"+name
    headers={"apikey":key,"Authorization":"Bearer "+key}
    if data is not None:headers.update({"Content-Type":kind,"x-upsert":"true"})
    for attempt in range(5):
        req=urllib.request.Request(url,data=data,headers=headers,method="POST" if data is not None else "GET")
        try:
            with urllib.request.urlopen(req,timeout=90) as response:return response.read()
        except urllib.error.HTTPError as e:
            detail=e.read().decode("utf-8","replace")
            if data is None and (e.code==404 or (e.code==400 and ("not_found" in detail.lower() or "not found" in detail.lower()))):return None
            if e.code not in (408,425,429,500,502,503,504,520,522,524) or attempt==4:raise RuntimeError(f"{name}: HTTP {e.code}: {detail[:200]}") from e
        except (TimeoutError,urllib.error.URLError):
            if attempt==4:raise
        delay=min(30,2**attempt)+random.uniform(0,1)
        print(f"Transient storage failure for {name}; retry {attempt+1}/5 in {delay:.1f}s",flush=True)
        time.sleep(delay)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--pbf",type=Path,required=True)
    p.add_argument("--database",type=Path,default=Path("/tmp/travelempire-greece.sqlite"))
    p.add_argument("--max-tiles",type=int,default=0)
    p.add_argument("--refresh-existing",action="store_true",help="Compare all cached tiles against the current PBF and replace changed tiles")
    args=p.parse_args()
    if args.database.exists():args.database.unlink()
    db=sqlite3.connect(args.database)
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("CREATE TABLE edges(tile TEXT, line TEXT)")
    pending=[]
    class Handler(osmium.SimpleHandler):
        def way(self,w):
            highway=w.tags.get("highway")
            if highway not in ALLOWED or w.tags.get("area")=="yes":return
            if any(w.tags.get(k) in ("no","private") for k in ("access","vehicle","motor_vehicle","motorcar")):return
            direction=str(w.tags.get("oneway","")).lower()
            oneway=-1 if direction=="-1" else 1 if direction in ("yes","1","true") or w.tags.get("junction")=="roundabout" else 0
            raw=str(w.tags.get("maxspeed","")).lower()
            try:
                speed=float(raw.split()[0])*(1.609344 if "mph" in raw else 1)
                if not 5<=speed<=160:raise ValueError()
                speed=round(speed)
            except (ValueError,IndexError):speed=SPEED.get(highway,50)
            nodes=list(w.nodes)
            for i,(a,b) in enumerate(zip(nodes,nodes[1:])):
                try:p=[a.lon,a.lat];q=[b.lon,b.lat]
                except osmium.InvalidLocationError:continue
                meters=6371008.8*math.hypot(math.radians(q[0]-p[0])*math.cos(math.radians((p[1]+q[1])/2)),math.radians(q[1]-p[1]))
                if meters<=0:continue
                tile=f"{math.floor((p[0]+q[0])*5)}_{math.floor((p[1]+q[1])*5)}"
                edge={"id":f"osm-{w.id}-{i}","a":a.ref,"b":b.ref,"coordinates":[p,q],"length":round(meters,2),"highway":highway,"speed":speed,"oneway":oneway}
                pending.append((tile,json.dumps(edge,separators=(",",":"))))
                if len(pending)>=10000:
                    db.executemany("INSERT INTO edges VALUES (?,?)",pending);pending.clear()
    print("Parsing Greece OSM PBF",flush=True)
    Handler().apply_file(str(args.pbf),locations=True,idx="flex_mem")
    if pending:db.executemany("INSERT INTO edges VALUES (?,?)",pending)
    db.commit()
    db.execute("CREATE INDEX edges_tile ON edges(tile)")
    db.commit()
    name="supplemental-manifest.json"
    old=storage(name)
    manifest=json.loads(old) if old else {"format":"travelempire-road-tiles-v1","tileSize":0.1,"tiles":{}}
    if manifest.get("tileSize")!=0.1:raise RuntimeError("Incompatible tile size")
    cached=manifest["tiles"]
    all_tiles=[row[0] for row in db.execute("SELECT DISTINCT tile FROM edges ORDER BY tile")]
    missing=[tile for tile in all_tiles if tile not in cached]
    candidates=all_tiles if args.refresh_existing else missing
    print(f"Nationwide tiles {len(all_tiles)}, cached {len(all_tiles)-len(missing)}, missing {len(missing)}, refresh={args.refresh_existing}",flush=True)
    changed=0
    for index,tile in enumerate(candidates[:args.max_tiles] if args.max_tiles else candidates,1):
        lines=[row[0] for row in db.execute("SELECT line FROM edges WHERE tile=?",(tile,))]
        if not lines:continue
        raw=("\n".join(lines)+"\n").encode()
        digest=hashlib.sha256(raw).hexdigest()
        previous=cached.get(tile)
        if previous and previous.get("sha256")==digest:continue
        # Content-addressed filenames avoid clients receiving a stale CDN-cached tile.
        filename=f"{tile}-{digest[:16]}.jsonl.gz"
        storage(filename,gzip.compress(raw,compresslevel=5),"application/gzip")
        cached[tile]={"file":filename,"edges":len(lines),"sha256":digest}
        # Publish the manifest only after the new tile is uploaded successfully.
        storage(name,json.dumps(manifest,separators=(",",":")).encode())
        changed+=1
        if changed%10==0:print(f"Published {changed} changed/new tiles; {len(cached)} total",flush=True)
    print(f"Complete: {len(cached)} tiles in Supabase manifest; {changed} updated",flush=True)
    db.close()
if __name__=="__main__":main()
