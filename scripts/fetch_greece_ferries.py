#!/usr/bin/env python3
"""Fetch real Greek ferry ways from OpenStreetMap Overpass and build the game's ferry network.

Run: python3 scripts/fetch_greece_ferries.py
Optional: OVERPASS_URL=https://overpass-api.de/api/interpreter python3 scripts/fetch_greece_ferries.py

Requires network access. Does not invent timetables or terminal ramps.
Only ways with an explicit OSM duration are imported by build_ferry_network.py.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from build_ferry_network import build

QUERY='''[out:json][timeout:180];
area["ISO3166-1"="GR"]["admin_level"="2"]->.greece;
way["route"="ferry"](area.greece);
out geom tags;'''

def main():
    endpoint=os.environ.get('OVERPASS_URL','https://overpass.kumi.systems/api/interpreter')
    request=urllib.request.Request(endpoint,data=urllib.parse.urlencode({'data':QUERY}).encode(),headers={'User-Agent':'TravelEmpireFerryImporter/2.2.3 (OSM attribution)'})
    with urllib.request.urlopen(request,timeout=240) as response:
        data=json.load(response)
    features=[]
    for item in data.get('elements',[]):
        if item.get('type')!='way':continue
        geometry=item.get('geometry') or []
        coords=[[p['lon'],p['lat']] for p in geometry if 'lon'in p and 'lat'in p]
        if len(coords)<2:continue
        tags=dict(item.get('tags') or {})
        tags['@id']='way/'+str(item['id'])
        features.append({'type':'Feature','properties':tags,'geometry':{'type':'LineString','coordinates':coords}})
    network=build({'type':'FeatureCollection','features':features})
    output=Path('public/data/ferries/GRC.json')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(network,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f"OSM ferry ways: {len(features)}; imported routes with explicit durations: {len(network['routes'])}; ports: {len(network['ports'])}")
    print('Verify terminal road access and OSM attribution before enabling crossings.')
    if not network['routes']:
        print('No duration-tagged ferry routes found. Output remains empty; no fictional crossing times were generated.',file=sys.stderr)

if __name__=='__main__':
    main()
