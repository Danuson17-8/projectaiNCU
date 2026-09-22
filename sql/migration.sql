-- ============================================================
-- Issue Desk — full migration (tables + RLS + RPC + seed data)
-- Paste once into Supabase Dashboard → SQL Editor → Run
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon_color text not null default '#0F6C61',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems(id) on delete cascade,
  message text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_system_id_idx on public.tickets(system_id);

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

-- systems: public picker — anon sees only active rows
drop policy if exists "systems_public_select_active" on public.systems;
create policy "systems_public_select_active"
on public.systems for select
to anon
using (is_active = true);

-- systems: admin (authenticated) full read + write
drop policy if exists "systems_admin_select_all" on public.systems;
create policy "systems_admin_select_all"
on public.systems for select
to authenticated
using (true);

drop policy if exists "systems_admin_insert" on public.systems;
create policy "systems_admin_insert"
on public.systems for insert
to authenticated
with check (true);

drop policy if exists "systems_admin_update" on public.systems;
create policy "systems_admin_update"
on public.systems for update
to authenticated
using (true)
with check (true);

drop policy if exists "systems_admin_delete" on public.systems;
create policy "systems_admin_delete"
on public.systems for delete
to authenticated
using (true);

-- tickets: anon (and authenticated, e.g. an admin still signed in on
-- another tab of the same site) may INSERT only, never SELECT directly
drop policy if exists "tickets_public_insert" on public.tickets;
create policy "tickets_public_insert"
on public.tickets for insert
to anon, authenticated
with check (true);

-- tickets: admin (authenticated) full read + status update
drop policy if exists "tickets_admin_select_all" on public.tickets;
create policy "tickets_admin_select_all"
on public.tickets for select
to authenticated
using (true);

drop policy if exists "tickets_admin_update" on public.tickets;
create policy "tickets_admin_update"
on public.tickets for update
to authenticated
using (true)
with check (true);

-- ---------- RPC: public "track my ticket" lookup ----------
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
grant execute on function public.track_ticket(uuid) to anon;
grant execute on function public.track_ticket(uuid) to authenticated;

-- ---------- Seed data ----------
insert into public.systems (name, slug, description, icon_color, is_active)
values
  ('ระบบล็อกอิน', 'login', 'แจ้งปัญหาการเข้าสู่ระบบ ลืมรหัสผ่าน หรือบัญชีถูกล็อก', '#0F6C61', true),
  ('หน้าชำระเงิน', 'payment', 'แจ้งปัญหาการชำระเงิน บัตรถูกตัดเงินแต่ออเดอร์ไม่สำเร็จ', '#D6820F', true),
  ('ระบบรายงาน', 'reports', 'แจ้งปัญหาการออกรายงานหรือข้อมูลไม่ถูกต้อง', '#2E9455', true)
on conflict (slug) do nothing;
