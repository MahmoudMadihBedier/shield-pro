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
--
-- Note: The table is created in 0001_enable_rls.sql. This migration only
-- adds the simple permissive policy if the table exists.
-- ============================================================================

-- Only add the policy if the table exists (created in 0001_enable_rls.sql)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_locations') then
    alter table public.user_locations enable row level security;
    
    drop policy if exists user_locations_policy on public.user_locations;
    create policy user_locations_policy on public.user_locations
      for all
      using (auth.uid() is not null);
  end if;
end $$;
