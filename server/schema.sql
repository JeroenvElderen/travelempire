-- Run in Supabase SQL Editor. This table tracks backend liveness only.
-- It does NOT store game state or enable background vehicle simulation.
create table if not exists public.server_heartbeat (
 service_name text primary key,
 instance_id uuid not null,
 last_seen_at timestamptz not null default now(),
 tick_count bigint not null default 0
);
alter table public.server_heartbeat enable row level security;
-- No client policies: service-role access only.
