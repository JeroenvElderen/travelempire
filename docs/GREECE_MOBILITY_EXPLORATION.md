# Walking and cycling exploration across Greece

The existing taxi road network remains unchanged. Pedestrian and cycling routes are exported into a separate public manifest and independent OSM tile files in the already-public `travelempire-road-tiles` Supabase Storage bucket.

## Access model

- Walking: OSM `footway`, `pedestrian`, `steps`, accessible `path` and shared local streets.
- Cycling: `cycleway`, permitted shared streets, and explicitly permitted `footway` / `path` / `pedestrian` roads.
- Access tags `foot`, `bicycle`, `access`, `vehicle`, `motorroad`, and bicycle-specific one-way restrictions are considered. Uncertain `path` cycling is conservatively excluded unless explicitly allowed.
- Independently mapped sidewalks are imported as OSM footways; `sidewalk=*` on streets is a property of the existing way, **not** an invented second parallel road.
- `highway=steps` never permits bicycle riding; no road is invented at a visually overlapping bridge or tunnel.
- Additional conditional and municipal access laws may be absent from OSM. This is a game-routing approximation, not legal navigation advice.

## Stage the new Greece dataset on your Mac

1. Pull the latest TravelEmpire source.
2. Run these commands with the local October 2026 Greek PBF.

```bash
cd ~/Developer/travelempire
source .venv-pois/bin/activate
git pull origin main
python -m pip install osmium
python scripts/build_greece_mobility_tiles.py --pbf data/osm/greece-261028.osm.pbf --output data/greece-mobility-tiles
cat data/greece-mobility-tiles/validation.json
```

Check `readyToUpload: true`, `completeGreece: true`, total walking and cycling segments, and the tile count before publishing. The generator streams to disk; it does not load all of Greece into memory at once.

## Upload and verify the mobility tiles

The uploader reuses the existing public road bucket, but filenames start with `mobility_`, so it cannot overwrite the existing taxi road tiles.

```bash
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the shell
python scripts/upload_geographic_road_tiles.py --input data/greece-mobility-tiles --workers 4
```

Require `failed 0`. Then:

```bash
python scripts/activate_greece_mobility.py --input data/greece-mobility-tiles
python scripts/activate_greece_mobility.py --input data/greece-mobility-tiles --confirm
git add public/data/mobility/tiles-manifest.json
git commit -m "Activate Greece walking and cycling exploration tiles"
git push origin main
```

The separate mobility manifest is the only file required to activate this dataset. Don't commit `data/greece-mobility-tiles` or overwrite `public/data/roads/tiles-manifest.json`.

## Use it in TravelEmpire

Open **World → Map Layers → Walking & Cycling Exploration (islands)**.

- Select a discovered/unlocked harbour (ferry arrivals already unlock destinations).
- Deploy either a walking or a cycling scout.
- Each scout follows the actual directed OSM path network, discovering paths upon traversal; walking and cycling progress are stored separately in IndexedDB for each company.
- Green lines indicate walked paths; blue/cyan lines indicate cycled routes; grey dashed lines are accessible, not-yet-explored paths visible at zoom 13+.
- The active scout prefetches nearby mobility tiles on demand; the game does not merge the nationwide pedestrian/cycle network into the taxi graph.
- This first iteration runs one scout of each mode. Deployment is initiated from an unlocked harbour, not an automatic purchase or boarding of ferry tickets.

## Checks and rollback

```bash
python -m unittest discover -s scripts/tests -p 'test_greece_mobility.py' -v
npm run build
```

To roll back the data activation, revert the Git commit that changed `public/data/mobility/tiles-manifest.json`; the taxi dataset stays intact. The immutable uploaded mobility objects can remain unused without affecting motor traffic.
