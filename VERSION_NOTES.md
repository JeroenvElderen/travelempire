# TravelEmpire v1.0 — pre-backend consolidated source

Merged sequentially from the original v0.8 source and versioned patches through v1.0.

Includes taxi operations, smooth vehicle SVG movement, local exploration state, fog-of-war polygon worker, mission constraints and OSM speed limits at 4× simulation speed.

## Setup

1. Copy `.env.example` to `.env.local` and configure `VITE_MAPTILER_KEY` (if the example is present).
2. Run `npm install` to install dependencies and update the lockfile.
3. Run `npm run build`, then `npm run dev`.

## Known limitations

- This is an assembled integration package; builds and browser gameplay have **not** been validated in this environment because npm dependencies could not be installed.
- ADM3 region inspection currently shows an approximate *global* explored-edge ratio, **not** an accurate per-region road-length percentage. Territory purchase remains disabled.
- The road preview is included from the original v0.8 archive; browser performance depends on dataset size and hardware.
- No backend, server-side OSRM or database is included.
