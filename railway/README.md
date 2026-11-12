# TravelEmpire Railway regional routing pilot

This is **phase 1**, not a server-authoritative game migration. It is an optional
stateless routing service with an LRU tile cache and a health endpoint. The
Cloudflare Pages game remains authoritative and falls back to its existing
dispatch worker when the service cannot route safely.

## Railway setup

1. Deploy the GitHub repository as a new Railway service. Set the **Root
   Directory** to `/` and use the Dockerfile path `railway/Dockerfile`.
2. Configure:
   - `ROAD_ASSET_BASE_URL`: absolute HTTPS URL for the *public* road directory,
     e.g. `https://your-game.pages.dev/data/roads` (contains
     `tiles-manifest.json`). Do not include the manifest filename.
   - `SUPABASE_URL`: existing Supabase project URL (no secrets), if your road
     packages are in the `travelempire-road-tiles` public bucket.
   - `CORS_ORIGIN`: your exact Cloudflare Pages game origin, e.g.
     `https://your-game.pages.dev`. Multiple allowed origins can be separated
     with commas.
   - `MAX_ROUTE_TILES`: default 6 (hard maximum 16).
   - `MAX_CACHED_ROADS`: default 160000 (hard maximum 600000).
   - Railway provides `PORT` automatically.
3. Generate a public Railway service domain. Open `https://YOUR-DOMAIN/health`
   and verify `configured: true`.
4. Set `VITE_RAILWAY_ROUTING_URL=https://YOUR-DOMAIN` in **Cloudflare Pages**
   build-time environment variables. Rebuild the frontend.
5. Route requests use `POST /v1/route` with
   `{"from":[lng,lat],"to":[lng,lat]}`. They return
   `{"path":[[lng,lat],...],"edgeIds":["osm-id",...],"length":123}`.

## Limitations / safety

- For now, only ordinary **explicit explorer return-to-depot** requests may use
  Railway when the feature flag is configured. Every failed/slow/incomplete
  request falls back to the local worker. **Discovered-only** routing, ferry
  tickets, exploration planning, automatic taxi routing and simulation remain
  local until we implement server-side parity and authoritative state sync.
- Queries wider than the regional tile budget return `422` with
  `fallback: true`; never return an incorrect straight-line path.
- The bounded LRU cache stores parsed road packages and drops older entries,
  but each request currently builds a temporary regional graph. A long-lived
  optimized shared graph and multi-vehicle simulation require another phase.
- Browser requests are permitted only from `CORS_ORIGIN`. A public HTTP API
  also requires rate-limiting and abuse controls before broad rollout.
- **Do not put any Supabase service-role key in the frontend or Railway config
  for this service.** This prototype reads only public road assets.
- No Supabase schema migration is required.
- Server routing is opt-in; without the frontend variable, existing gameplay
  continues unchanged.
