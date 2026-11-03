#!/usr/bin/env python3
"""Fetch Greek OSM ferry ways and upload a validated network directly to Supabase Storage.

Required environment variables:
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_SERVICE_ROLE_KEY

Usage from repository root:
  python3 scripts/upload_greece_ferries_supabase.py

Creates public bucket 'travelempire-ferries' if needed and uploads 'GRC.json'.
No third-party Python packages needed. Never expose the service role key in Vite
variables or commit it to Git. Will NOT overwrite remote data with zero routes.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from build_ferry_network import build

BUCKET = "travelempire-ferries"
OBJECT = "GRC.json"
# Split Greece into smaller areas; include an overlap to avoid boundary gaps.
# OSM area filter prevents importing nearby foreign routes from the bounding boxes.
REGIONS = [
    (34.5, 19.0, 38.4, 24.5),
    (34.5, 24.4, 38.4, 30.2),
    (38.3, 19.0, 42.2, 24.5),
    (38.3, 24.4, 42.2, 30.2),
]
ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
]
def query_for(region):
    south,west,north,east=region
    return (f'[out:json][timeout:80];'
            f'area["ISO3166-1"="GR"]["admin_level"="2"]->.greece;'
            f'way["route"="ferry"]({south},{west},{north},{east})(area.greece);'
            f'out geom tags;')

def request_json(url, *, method="GET", payload=None, key=None, content_type="application/json", timeout=240):
    headers={"User-Agent":"TravelEmpireFerryImporter/2.2.3.1"}
    if key:
        headers.update({"Authorization":f"Bearer {key}","apikey":key})
    if payload is not None:
        headers["Content-Type"]=content_type
    req=urllib.request.Request(url,data=payload,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as response:
            raw=response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail=exc.read().decode("utf-8",errors="replace")[:500]
        raise RuntimeError(f"{method} {url.split('?')[0]} returned HTTP {exc.code}: {detail}") from exc

def fetch_osm():
    configured=os.environ.get("OVERPASS_URL")
    endpoints=[configured] if configured else ENDPOINTS
    elements={}
    for index,region in enumerate(REGIONS,1):
        payload=urllib.parse.urlencode({"data":query_for(region)}).encode()
        errors=[]
        for attempt in range(3):
            endpoint=endpoints[attempt % len(endpoints)]
            print(f"Fetching region {index}/{len(REGIONS)}, attempt {attempt+1}...",flush=True)
            try:
                result=request_json(endpoint,method="POST",payload=payload,
                                    content_type="application/x-www-form-urlencoded",timeout=105)
                if "elements" not in result:
                    raise RuntimeError("Overpass returned no elements field")
                for element in result["elements"]:
                    if element.get("type")=="way" and "id" in element:
                        elements[element["id"]]=element
                print(f"Region {index} complete; {len(elements)} unique ways so far",flush=True)
                break
            except (RuntimeError,urllib.error.URLError,TimeoutError,ValueError) as exc:
                errors.append(str(exc)[:180])
                print(f"Overpass attempt failed: {errors[-1]}",flush=True)
                if attempt<2:time.sleep(3*(attempt+1))
        else:
            raise RuntimeError(f"Region {index} failed on all endpoints. "
                               f"Refusing partial Supabase upload. Errors: {errors}")
    return {"elements":list(elements.values())}

def main():
    url=os.environ.get("SUPABASE_URL","").rstrip("/")
    key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")
    if not url.startswith("https://") or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.")
    print("Fetching ferry ways from OpenStreetMap...")
    osm=fetch_osm()
    features=[]
    for element in osm.get("elements",[]):
        if element.get("type")!="way":continue
        coords=[[p["lon"],p["lat"]] for p in element.get("geometry",[]) if "lon" in p and "lat" in p]
        if len(coords)<2:continue
        tags=dict(element.get("tags") or {})
        tags["@id"]=f"way/{element['id']}"
        features.append({"type":"Feature","properties":tags,"geometry":{"type":"LineString","coordinates":coords}})
    network=build({"type":"FeatureCollection","features":features})
    print(f"OSM ferry ways: {len(features)}; duration-tagged routes: {len(network['routes'])}; provisional ports: {len(network['ports'])}")
    if not network["routes"]:
        sys.exit("No valid routes found. Remote data was NOT overwritten. Ferry durations must be present in OSM.")
    if len(network["routes"]) < 3:
        sys.exit("Fewer than 3 routes found. Aborting to avoid publishing an incomplete network.")
    storage=f"{url}/storage/v1"
    try:
        bucket=request_json(f"{storage}/bucket/{BUCKET}",key=key)
        print("Using existing bucket:",bucket.get("name",BUCKET))
    except RuntimeError as exc:
        if "HTTP 404" not in str(exc):
            raise
        request_json(f"{storage}/bucket",method="POST",payload=json.dumps({"id":BUCKET,"name":BUCKET,"public":True,"file_size_limit":52428800,"allowed_mime_types":["application/json"]}).encode(),key=key)
        print("Created public bucket:",BUCKET)
    body=json.dumps(network,ensure_ascii=False,separators=(",",":")).encode("utf-8")
    object_url=f"{storage}/object/{BUCKET}/{OBJECT}"
    headers={"Authorization":f"Bearer {key}","apikey":key,"Content-Type":"application/json","x-upsert":"true","Cache-Control":"3600","User-Agent":"TravelEmpireFerryImporter/2.2.3.1"}
    req=urllib.request.Request(object_url,data=body,headers=headers,method="POST")
    try:
        with urllib.request.urlopen(req,timeout=120) as response:
            if response.status not in (200,201):
                raise RuntimeError(f"Upload status: {response.status}")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Supabase upload failed (HTTP {exc.code}): {exc.read().decode(errors='replace')[:500]}") from exc
    print(f"Uploaded {len(network['routes'])} routes ({len(body):,} bytes) to {BUCKET}/{OBJECT}")
    print("WARNING: Port coordinates are provisional; verify boarding ramps before activating vehicle transfers.")

if __name__=="__main__":
    main()
