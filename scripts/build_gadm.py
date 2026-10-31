#!/usr/bin/env python3
"""Export GADM 4.1 ADM1 regions from a worldwide, single-layer GeoPackage."""
import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAYER = "gadm_410"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT / "gadm_410.gpkg")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--country", help="Three-letter GADM country code, e.g. GRC")
    mode.add_argument("--all", action="store_true")
    parser.add_argument("--level", type=int, choices=[1, 2, 3], default=3, help="Preferred administrative level (default: ADM3)")
    parser.add_argument("--simplify", type=float, default=0.0003,
                        help="Tolerance in degrees for browser preview (default 0.002)")
    args = parser.parse_args()
    if args.simplify < 0:
        parser.error("--simplify must be >= 0")
    try:
        import geopandas as gpd
        import pyogrio
    except ImportError as exc:
        raise SystemExit("Install dependencies: python3 -m pip install geopandas pyogrio shapely") from exc
    if not args.input.is_file():
        raise SystemExit(f"GeoPackage not found: {args.input}")
    layers = [row[0] for row in pyogrio.list_layers(args.input)]
    if LAYER not in layers:
        raise SystemExit(f"Expected layer {LAYER!r}; found {layers}")
    with sqlite3.connect(args.input) as conn:
        cols = {row[1] for row in conn.execute('PRAGMA table_info("gadm_410")')}
        required = {"GID_0", "GID_1", "NAME_1", "NAME_0", "GID_2", "NAME_2", "GID_3", "NAME_3"}
        if not required.issubset(cols):
            raise SystemExit(f"Missing GADM columns: {sorted(required-cols)}")
        countries = conn.execute(
            'SELECT GID_0, MAX(NAME_0) FROM "gadm_410" '
            'WHERE GID_0 IS NOT NULL GROUP BY GID_0 ORDER BY GID_0'
        ).fetchall()
    codes = {code for code, _ in countries}
    selected = sorted(codes) if args.all else [args.country.upper()]
    if any(code not in codes for code in selected):
        raise SystemExit(f"Unknown country: {selected}; example: GRC")
    output = ROOT / "public" / "data" / "gadm"
    output.mkdir(parents=True, exist_ok=True)
    (output / "manifest.json").write_text(
        json.dumps({"countries": [{"code": code, "name": name} for code, name in countries]},
                   ensure_ascii=False), encoding="utf-8"
    )
    for code in selected:
        print(f"Reading {code} from {LAYER}...", flush=True)
        frame = gpd.read_file(
            args.input, layer=LAYER, engine="pyogrio",
            where=f"GID_0 = '{code}'",
            columns=["GID_0", "NAME_0", "GID_1", "NAME_1", "GID_2", "NAME_2", "GID_3", "NAME_3"],
        )
        frame = frame.loc[frame.geometry.notna() & ~frame.geometry.is_empty].copy()
        if frame.empty:
            print(f"Skipping {code}: no geometries")
            continue
        if frame.crs is None:
            raise SystemExit("Dataset CRS missing")
        frame = frame.to_crs("EPSG:4326")
        # Each country uses the deepest available level up to the requested level.
        # Do not silently merge ADM3-null features into an invented ADM3 region.
        level = next((n for n in range(args.level, 0, -1) if frame[f"GID_{n}"].notna().any()), None)
        if level is None:
            print(f"Skipping {code}: no ADM1–ADM{args.level} data")
            continue
        frame = frame.loc[frame[f"GID_{level}"].notna()].copy()
        regions = frame.dissolve(by=f"GID_{level}", as_index=False, aggfunc="first")
        if args.simplify:
            regions["geometry"] = regions.geometry.simplify(args.simplify, preserve_topology=True)
        regions = regions[["GID_0", "NAME_0", f"GID_{level}", f"NAME_{level}", "geometry"]]
        # Normalize properties so the frontend supports different levels transparently.
        regions["regionId"] = regions[f"GID_{level}"].astype(str)
        regions["regionName"] = regions[f"NAME_{level}"].fillna(regions["regionId"])
        regions["adminLevel"] = level
        destination = output / f"{code}.geojson"
        destination.write_text(regions.to_json(drop_id=True), encoding="utf-8")
        print(f"  Exported {len(regions)} ADM{level} regions to {destination.relative_to(ROOT)} "
              f"({destination.stat().st_size / 1024:.0f} KiB)", flush=True)
    print("Done. Reload the TravelEmpire browser tab.")

if __name__ == "__main__":
    main()
