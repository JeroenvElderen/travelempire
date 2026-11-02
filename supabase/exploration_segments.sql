-- TravelEmpire v2.2.3: cloud exploration (run in Supabase SQL Editor)
-- Enable Authentication > Providers > Anonymous Sign-ins first.
create table if not exists public.exploration_segments (
 user_id uuid not null default auth.uid(),
 company_id uuid not null,
 road_id text not null,
 segments jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now(),
 primary key (user_id, company_id, road_id),
 constraint exploration_segments_nonempty_id check (length(road_id)>0),
 constraint exploration_segments_array check (jsonb_typeof(segments)='array')
);
create index if not exists exploration_segments_company_idx
 on public.exploration_segments (user_id,company_id);
alter table public.exploration_segments enable row level security;
drop policy if exists exploration_select_own on public.exploration_segments;
drop policy if exists exploration_insert_own on public.exploration_segments;
drop policy if exists exploration_update_own on public.exploration_segments;
create policy exploration_select_own on public.exploration_segments
 for select to authenticated using (user_id=auth.uid());
create policy exploration_insert_own on public.exploration_segments
 for insert to authenticated with check (user_id=auth.uid());
create policy exploration_update_own on public.exploration_segments
 for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update on public.exploration_segments to authenticated;
-- Never grant client access using a service_role key.
