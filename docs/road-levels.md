# Vertical OSM roads: bridges, tunnels and parking floors

The game now supports four **optional** properties on road JSONL segments:

- `layer`: OSM relative stacking order; negative does not by itself mean tunnel
- `bridge`: true when OSM bridge tag is present and affirmative
- `tunnel`: true when the OSM tunnel tag is present and affirmative
- `level`: optional numeric building-floor tag; not interchangeable with `layer`

Old v1 road archives remain compatible; missing metadata means normal surface rendering.
Routing continues to use real OSM node IDs and directed edges. Roads crossing in a
2D image are NOT joined automatically.

## Safe Greece tile deployment (Supabase)

The source files must come from the SAME OSM extract/import generation as the
current graph, or at least preserve the same way IDs. Do **not** generate a
replacement graph that changes segment IDs: saved purple exploration uses IDs.

1. Download your existing `*.jsonl.gz` geographic road tiles and the current
   `tiles-manifest.json` to a local directory. Retain them as a backup.
2. On a computer with your original Greece `.osm.pbf`, install `osmium`:
   `python3 -m pip install osmium`.
3. Run:
   ```bash
   python3 scripts/enrich_geographic_road_tiles.py \
     --input /path/to/current-tiles \
     --pbf /path/to/greece.osm.pbf \
     --output /path/to/tiles-v2
   ```
   The conversion checks that way IDs can be extracted and found in the PBF.
   If IDs have a different format, use `--way-id-pattern` to provide a
   capture group containing the OSM way ID. **Never deploy a failed run.**
4. Upload **all** new `*.v2.jsonl.gz` files to the existing public Supabase
   Storage bucket `travelempire-road-tiles`. They have new names; the old
   files remain operational as a rollback option. Do not rename them.
5. Update the bundled `public/data/roads/tiles-manifest.json` with the
   generated v2 manifest, commit and deploy the frontend. If you also use
   `supplemental-manifest.json` in Supabase, update it to matching v2 file
   references (and compatible tile size). The frontend's existing manifest
   merge behaviour still applies.
6. Check the map and console for `roads:publish`, tunnels and bridges.
   If anything is wrong, revert the v2 manifest; do not delete the v1 files
   before successful validation.

**No Supabase database schema changes, new bucket or credentials are required.**
The existing parsed-tile IndexedDB cache keys include the manifest format and
filename, so the v2 filenames make refreshed content distinguishable from v1.

### Visual semantics

- Surface and elevated roads are solid.
- Tunnels are dashed on the game overlay.
- Bridges have a pale elevated highlight.
- While a vehicle traverses an explicit `tunnel=true` edge, its map marker
  is visually hidden (simulation and discovery continue). The Map Layers
  option **Show vehicles inside tunnels (ghosted)** lets you inspect it.
- `level` is stored for a later dedicated multi-storey parking floor UI.
  Merely providing `level` does not invent ramps or floor connections.

### Limits

The renderer uses the simplified two-endpoint road edges already in the game.
It cannot infer actual floor heights, hidden road sections without tags or
3D tunnel roofs. Incorrect OSM mapping requires correcting the source data.
