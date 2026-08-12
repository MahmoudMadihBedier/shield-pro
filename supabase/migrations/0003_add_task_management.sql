-- ============================================================================
-- 0003_add_task_management.sql
--
-- Adds task management system for HR module:
-- - tasks: Admin can assign tasks to employees, employees can update status and add feedback
-- - employee_reports: Employees can report mistakes by other employees (complaints)
-- - bonuses: Admin can add bonuses to employees
-- - punishments: Admin can add punishments/deductions to employees
-- ============================================================================

-- Link a staff record to exactly one login account.  Without this link the
-- database cannot safely decide which tasks belong to the signed-in employee.
alter table public.employees
  add column if not exists user_id uuid references public.users(id) on delete set null;
create unique index if not exists employees_user_id_unique_idx
  on public.employees(user_id) where user_id is not null;

-- The task page needs the signed-in employee's own profile to determine which
-- assignments belong to them. This does not reveal other employee records.
drop policy if exists employees_select_own on public.employees;
create policy employees_select_own on public.employees for select to authenticated
  using (user_id = auth.uid());

-- A limited staff directory is needed for assigning tasks and selecting a
-- colleague in an escalation. It intentionally omits salary and HR fields.
-- The view runs as its owner so it can expose this safe subset without giving
-- ordinary employees broad read access to public.employees.
create or replace view public.task_employee_directory
with (security_invoker = false)
as
  select id, name, role, user_id
  from public.employees;
grant select on public.task_employee_directory to authenticated;

-- Tasks table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('not_started', 'in_progress', 'done', 'cancelled')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  feedback text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_employee_id_idx on public.tasks(employee_id);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_due_date_idx on public.tasks(due_date);

-- Employee reports (complaints) table
create table if not exists public.employee_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.employees(id) on delete cascade,
  reported_employee_id uuid not null references public.employees(id) on delete cascade,
  description text not null,
  severity text default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text default 'pending' check (status in ('pending', 'under_review', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  resolution_notes text
);

create index if not exists employee_reports_reporter_id_idx on public.employee_reports(reporter_id);
create index if not exists employee_reports_reported_employee_id_idx on public.employee_reports(reported_employee_id);
create index if not exists employee_reports_status_idx on public.employee_reports(status);

-- Bonuses table
create table if not exists public.bonuses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  amount numeric not null,
  reason text,
  given_by uuid references public.users(id),
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists bonuses_employee_id_idx on public.bonuses(employee_id);
create index if not exists bonuses_date_idx on public.bonuses(date);

-- Punishments table
create table if not exists public.punishments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  amount numeric not null,
  reason text not null,
  given_by uuid references public.users(id),
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists punishments_employee_id_idx on public.punishments(employee_id);
create index if not exists punishments_date_idx on public.punishments(date);

-- The offline repository adds updated_at to every entity. Keep all task
-- management tables consistent with that shared entity contract so queued
-- bonuses, deductions, and reports are accepted by PostgREST.
alter table public.employee_reports
  add column if not exists updated_at timestamptz not null default now();
alter table public.bonuses
  add column if not exists updated_at timestamptz not null default now();
alter table public.punishments
  add column if not exists updated_at timestamptz not null default now();

-- Access helpers --------------------------------------------------------------
create or replace function public.is_task_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.has_permission('hr', 'edit');
$$;

create or replace function public.current_employee_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.employees where user_id = auth.uid() limit 1;
$$;

-- RLS limits rows, not columns. This trigger prevents an employee from using
-- a direct API request to change an assignment, title, deadline, or priority;
-- employees may only update their progress state and feedback.
create or replace function public.enforce_employee_task_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_task_admin() then
    if new.employee_id is distinct from old.employee_id
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.priority is distinct from old.priority
       or new.due_date is distinct from old.due_date
       or new.created_by is distinct from old.created_by
       or new.status = 'cancelled' then
      raise exception 'Employees may only update task progress and feedback';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_employee_task_update on public.tasks;
create trigger enforce_employee_task_update
  before update on public.tasks
  for each row execute function public.enforce_employee_task_update();

-- Enable RLS on new tables
alter table public.tasks enable row level security;
alter table public.employee_reports enable row level security;
alter table public.bonuses enable row level security;
alter table public.punishments enable row level security;

-- A manager controls assignments. An employee can read and update only their
-- own task, while escalation content is never selectable by employees.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_task_admin() or employee_id = public.current_employee_id());

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_task_admin());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_task_admin() or employee_id = public.current_employee_id())
  with check (public.is_task_admin() or employee_id = public.current_employee_id());

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_task_admin());

-- Employees may submit a report under their own employee identity, but only
-- an administrator can read, resolve, or dismiss any escalation.
drop policy if exists employee_reports_select on public.employee_reports;
create policy employee_reports_select on public.employee_reports for select to authenticated using (public.is_task_admin());

drop policy if exists employee_reports_insert on public.employee_reports;
create policy employee_reports_insert on public.employee_reports for insert to authenticated
  with check (
    public.is_task_admin()
    or (reporter_id = public.current_employee_id() and reported_employee_id <> reporter_id)
  );

drop policy if exists employee_reports_update on public.employee_reports;
create policy employee_reports_update on public.employee_reports for update to authenticated using (public.is_task_admin()) with check (public.is_task_admin());

drop policy if exists employee_reports_delete on public.employee_reports;
create policy employee_reports_delete on public.employee_reports for delete to authenticated using (public.is_task_admin());

-- Financial reward/discipline records are HR-admin only.
drop policy if exists bonuses_select on public.bonuses;
create policy bonuses_select on public.bonuses for select to authenticated using (public.is_task_admin());

drop policy if exists bonuses_insert on public.bonuses;
create policy bonuses_insert on public.bonuses for insert to authenticated with check (public.is_task_admin());

drop policy if exists bonuses_update on public.bonuses;
create policy bonuses_update on public.bonuses for update to authenticated using (public.is_task_admin()) with check (public.is_task_admin());

drop policy if exists bonuses_delete on public.bonuses;
create policy bonuses_delete on public.bonuses for delete to authenticated using (public.is_task_admin());

drop policy if exists punishments_select on public.punishments;
create policy punishments_select on public.punishments for select to authenticated using (public.is_task_admin());

drop policy if exists punishments_insert on public.punishments;
create policy punishments_insert on public.punishments for insert to authenticated with check (public.is_task_admin());

drop policy if exists punishments_update on public.punishments;
create policy punishments_update on public.punishments for update to authenticated using (public.is_task_admin()) with check (public.is_task_admin());

drop policy if exists punishments_delete on public.punishments;
create policy punishments_delete on public.punishments for delete to authenticated using (public.is_task_admin());
