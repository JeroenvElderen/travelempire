# Greece data refresh on a Windows PC (November 2026)

This is a **two-phase staging procedure**: rename existing ferry terminals and
enrich existing road tiles with OSM bridge/tunnel/floor metadata.

**Do not regenerate road IDs.** Your saved purple exploration, taxi routes and
company data depend on the existing stable road segment and harbour IDs.

Run PowerShell from the TravelEmpire repo root. You need Python 3.12+ and your
local Greece `.osm.pbf` file. Replace `C:\\OSM\\greece.osm.pbf` with the
actual path on your PC.

## 0. Prepare

```powershell
git pull origin main
py -m pip install --upgrade osmium
New-Item -ItemType Directory -Force data | Out-Null
$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$PBF = "C:\\OSM\\greece.osm.pbf"
```

The Supabase URL is a public project URL; it is **not** a secret API key.
Do not commit the PBF, output tiles or files containing credentials.

## 1. Recover Greek ferry/harbour names

Download the **current** remote ferry data (the bundled GRC.json is deliberately
empty, so do not use it):

```powershell
Invoke-WebRequest "$env:SUPABASE_URL/storage/v1/object/public/travelempire-ferries/GRC.json" -OutFile "data/current-GRC.json"
py scripts/enrich_ferry_names_from_pbf.py --pbf "$PBF" --network data/current-GRC.json --output data/GRC-named.json
```

Examine `data/GRC-named.report.json` before uploading. It contains OSM
feature IDs, distance, matching feature type, and lists of ambiguous/unresolved
ports. An OSM locality is only a review suggestion, not a verified ferry
terminal. If a proposed name is incorrect, correct or revert that port in the
staged JSON before uploading.

Upload safely, **only after review**:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Supabase service-role key"
py scripts/upload_enriched_ferry_network.py --input data/GRC-named.json --backup data/GRC-before-names.json
py scripts/upload_enriched_ferry_network.py --input data/GRC-named.json --backup data/GRC-before-names.json --confirm
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

The uploader checks the current remote port IDs, positions and complete route
array first. If anything changed since the download, it **refuses** to upload.
It also writes a backup. The scheduled ferry importer now preserves existing
names for stable port IDs. Use **Ferries → Refresh data** after upload.

If you prefer not to use a service-role key on the PC, use the Supabase
Dashboard → Storage → `travelempire-ferries` → replace `GRC.json` manually,
after reviewing the backup and ensuring all IDs and routes are unchanged.

## 2. Preserve bridges, tunnels and multi-level roads

The browser already supports `layer`, `bridge`, `tunnel` and `level` on
road segments. It displays tunnels with dashed roads and can hide vehicles
inside tunnels. **Routing connects real OSM node IDs only**: two roads that
cross on the map but don't share a node do not become connected.

The current Supabase road tiles must be enriched *in place by ID* (with new
filenames), rather than rebuilding routing data from scratch.

### Download existing live tiles

```powershell
py scripts/download_live_road_tiles.py --output data/road-tiles-current
```

This merges the bundled manifest with compatible supplemental tiles and
downloads the current `.jsonl.gz` packages. The download can be large and
is resumable. Make sure the PC has sufficient free disk space.

### Enrich from your Greece PBF

```powershell
py scripts/enrich_geographic_road_tiles.py --input data/road-tiles-current --pbf "$PBF" --output data/road-tiles-v2
```

The script compares way IDs against the PBF and **refuses to produce a
deployment manifest** unless at least 90% of the indexed OSM ways and 95% of
the existing road segments match. Older/newer OSM extracts may fail this
check. In that case, stop and investigate; never force an incompatible
rebuild that would reset exploration progress.

The new filenames are `*.v2.jsonl.gz`. Old v1 files remain in Supabase
so reverting the manifest restores the old network.

### Stage the new files safely

1. In Supabase Storage, retain the original bucket contents.
2. Set the service role key locally as above, then run:
   ```powershell
   py scripts/upload_geographic_road_tiles.py --input data/road-tiles-v2
   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
   ```
   **Do not update the manifest until all uploads succeed.**
3. Check `data/road-tiles-v2/tiles-manifest.json`. The new bundled manifest
   includes all original and supplemental tile entries from the download.
4. Activate the manifest:
   ```powershell
   Copy-Item data/road-tiles-v2/tiles-manifest.json public/data/roads/tiles-manifest.json
   git add public/data/roads/tiles-manifest.json
   git commit -m "Activate Greece v2 road tiles with OSM layers and tunnel metadata"
   git push origin main
   ```
5. After Cloudflare deploys, test crossing bridges, entering tunnels, and
   one-way streets on your iPhone. Existing discovered roads should remain.
   An old Supabase `supplemental-manifest.json` is ignored when its format
   differs from the newly bundled v2 format.

**Rollback:** Revert only the bundled manifest Git commit and redeploy.
The old v1 compressed tiles remain available; do not delete them until the
new version has been thoroughly tested.

## Important limitations

- Tunnels/bridges and indoor floor levels must be mapped in OSM for their
  metadata to appear. A missing tag cannot be reconstructed from a picture.
- `layer` values are relative OSM stacking; `level` is an indoor floor tag.
  They must not be treated as equivalent.
- A crossing without a shared OSM node must **not** connect vehicles between
  the upper road and the lower road. Even if roads are visually overlapping,
  legal routing requires explicit real nodes/ramps.
- The road graph remains memory-intensive on iPhone; these metadata upgrades
  fix vertical correctness, not Safari memory exhaustion.
- No Supabase SQL schema migration is necessary for these two changes.
