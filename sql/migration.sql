-- ============================================================
-- ระบบแจ้งปัญหาการใช้งานระบบมหาวิทยาลัย — full migration (tables + RLS + RPC + seed data)
-- v2: requires login for every user (students/staff sign up), adds
--     a profiles table with an is_admin flag so admins and regular
--     users can both be "authenticated" without regular users
--     getting admin access.
-- Paste once into Supabase Dashboard → SQL Editor → Run
-- Safe to re-run: every statement is idempotent.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon_color text not null default '#0F6C61',
  audience text not null default 'student' check (audience in ('student', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- older installs: add the audience column (who the system is for) and
-- tag the staff-facing defaults; only runs the first time, so later
-- edits made by admins are never overwritten
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'systems' and column_name = 'audience'
  ) then
    alter table public.systems
      add column audience text not null default 'student'
      check (audience in ('student', 'staff'));
    update public.systems set audience = 'staff' where slug in ('e-document', 'vehicle-booking');
  end if;
end $$;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems(id) on delete cascade,
  reporter_id uuid references auth.users(id),
  message text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- older installs: add the column if the table already existed without it
alter table public.tickets add column if not exists reporter_id uuid references auth.users(id);

create index if not exists tickets_system_id_idx on public.tickets(system_id);
create index if not exists tickets_reporter_id_idx on public.tickets(reporter_id);

-- profiles: one row per signed-up user, holds the admin flag
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- backfill profiles for any auth users that already existed before this table did
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- helper: is the currently-authenticated request an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- keep updated_at fresh on every UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.systems enable row level security;
alter table public.tickets enable row level security;
alter table public.profiles enable row level security;

-- drop v1 (anonymous) policies if they exist, from before login was required
drop policy if exists "systems_public_select_active" on public.systems;
drop policy if exists "systems_admin_select_all" on public.systems;
drop policy if exists "systems_admin_insert" on public.systems;
drop policy if exists "systems_admin_update" on public.systems;
drop policy if exists "systems_admin_delete" on public.systems;
drop policy if exists "tickets_public_insert" on public.tickets;
drop policy if exists "tickets_admin_select_all" on public.tickets;
drop policy if exists "tickets_admin_update" on public.tickets;

-- systems: any logged-in user sees active systems; admins see everything
drop policy if exists "systems_select_active_or_admin" on public.systems;
create policy "systems_select_active_or_admin"
on public.systems for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "systems_admin_insert" on public.systems;
create policy "systems_admin_insert"
on public.systems for insert
to authenticated
with check (public.is_admin());

drop policy if exists "systems_admin_update" on public.systems;
create policy "systems_admin_update"
on public.systems for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "systems_admin_delete" on public.systems;
create policy "systems_admin_delete"
on public.systems for delete
to authenticated
using (public.is_admin());

-- tickets: a logged-in user can only file/see their own; admins see all + update status
drop policy if exists "tickets_insert_own" on public.tickets;
create policy "tickets_insert_own"
on public.tickets for insert
to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "tickets_select_own_or_admin" on public.tickets;
create policy "tickets_select_own_or_admin"
on public.tickets for select
to authenticated
using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "tickets_admin_update" on public.tickets;
create policy "tickets_admin_update"
on public.tickets for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- profiles: a user may read only their own profile row (used by the admin auth guard)
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- ---------- RPC: legacy "track by ticket id" lookup ----------
-- No longer used by the frontend now that logged-in users see their own
-- tickets directly (report.html?ticket=<id> queries the table, which RLS
-- already restricts to the owner or an admin). Left in place, harmless,
-- in case something still calls it.
create or replace function public.track_ticket(ticket_id uuid)
returns table (
  id uuid,
  status text,
  message text,
  created_at timestamptz,
  system_name text
)
language sql
security definer
set search_path = public
as $$
  select t.id, t.status, t.message, t.created_at, s.name as system_name
  from public.tickets t
  join public.systems s on s.id = t.system_id
  where t.id = ticket_id;
$$;

revoke all on function public.track_ticket(uuid) from public;
grant execute on function public.track_ticket(uuid) to authenticated;

-- ---------- Seed data ----------
insert into public.systems (name, slug, description, icon_color, is_active, audience)
values
  ('ระบบ E-Document', 'e-document', 'แจ้งปัญหาการรับ-ส่งหนังสือราชการ ลงนาม หรือแนบไฟล์เอกสาร', '#2563EB', true, 'staff'),
  ('ระบบขอใช้รถมหาวิทยาลัย', 'vehicle-booking', 'แจ้งปัญหาการจองรถ การอนุมัติคำขอ หรือข้อมูลรถ/คนขับ', '#D97757', true, 'staff'),
  ('ระบบวีซ่า', 'visa', 'แจ้งปัญหาการยื่นคำขอวีซ่า อัปโหลดเอกสาร หรือสถานะคำขอ', '#7C3AED', true, 'student'),
  ('ระบบทะเบียนนักศึกษา', 'student-registry', 'แจ้งปัญหาการลงทะเบียนเรียน ผลการเรียน หรือข้อมูลนักศึกษา', '#0F6C61', true, 'student')
on conflict (slug) do nothing;

-- the v1 defaults are replaced by the list above; hide them from users
-- (deactivated rather than deleted so any tickets filed on them survive)
update public.systems
set is_active = false
where slug in ('login', 'payment', 'reports');

-- ---------- Make your existing admin account an actual admin ----------
-- Replace the email below with every admin account's email (comma-separate
-- more emails in the "in (...)" list if you have several).
update public.profiles
set is_admin = true
where email in ('danuson5809@gmail.com');
