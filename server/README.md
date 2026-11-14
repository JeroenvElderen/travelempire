# TravelEmpire Railway service (infrastructure stage)

This service runs independently of the Cloudflare Pages frontend. It exposes
`GET /health` and `GET /status`, maintains an in-memory scheduler, and
optionally writes a heartbeat to Supabase.

**Important:** This does NOT yet simulate taxis, exploration, jobs or finances
while Safari is closed. The current simulation and saves are browser-local.
A backend must first acquire authoritative company state, migrate the existing
simulation engine and road data, and implement durable idempotent ticks and
conflict-free browser synchronization. Do not enable two simulation writers.

## Railway deployment

1. Open https://railway.com/new and create a project.
2. Choose **GitHub Repo**, connect `JeroenvElderen/travelempire`,
   and select `main`.
3. Under service **Settings**, set **Root Directory** to `/server`.
   Railway will detect `server/Dockerfile` from that directory.
4. Under **Variables**, optionally add `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (the **secret service-role key**, NEVER
   a `VITE_*` variable). First run `schema.sql` in Supabase SQL Editor.
   The server also accepts `TICK_INTERVAL_MS` (default `10000`).
5. Deploy. In **Settings > Networking**, generate a public domain.
6. Open `https://<your-domain>/health`; verify `status: "running"`.
   `simulationActive: false` is expected until the game engine is migrated.

Keep the existing frontend on Cloudflare Pages. No frontend environment
variable is required for this infrastructure-only stage.
