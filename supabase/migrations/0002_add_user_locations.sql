-- ============================================================================
-- Adds public.user_locations (GPS rep-tracking), which the frontend
-- (RepTracking.tsx, Dexie schema v3) already reads/writes but which never
-- existed on the live DB — every location sync write was silently failing.
--
-- RLS policy here intentionally mirrors the simple, permissive style already
-- live today on public.users / public.roles / public.role_permissions
-- (`FOR ALL ... USING (auth.uid() IS NOT NULL)`), rather than the stricter
-- permission-matrix policies proposed in 0001_enable_rls.sql, to avoid
-- changing behavior on any other table as a side effect of this fix.
-- ============================================================================

create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_locations_user_id_recorded_at_idx
  on public.user_locations (user_id, recorded_at);

alter table public.user_locations enable row level security;

drop policy if exists user_locations_policy on public.user_locations;
create policy user_locations_policy on public.user_locations
  for all
  using (auth.uid() is not null);
