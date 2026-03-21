-- ── Admin support notes per org ──────────────────────────────────────────────
create table if not exists public.org_support_notes (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  admin_id   uuid references auth.users(id),
  note       text not null,
  created_at timestamptz not null default now()
);

alter table public.org_support_notes enable row level security;

create policy "super_admin_all_notes" on public.org_support_notes
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'));

-- ── Org flags (at-risk, VIP, follow-up, etc.) ────────────────────────────────
create table if not exists public.org_flags (
  org_id     uuid primary key references public.organizations(id) on delete cascade,
  flag       text not null default 'none',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.org_flags enable row level security;

create policy "super_admin_all_flags" on public.org_flags
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'));

-- ── Add trial.extended and trial.converted_to_paid to audit_log ──────────────
-- (these are just new event_type values — no schema change needed if audit_log.event_type is text)
