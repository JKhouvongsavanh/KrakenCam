-- ── Org settings table ────────────────────────────────────────────────────────
-- Stores all app settings per org so they sync across devices and team members.
-- Binary fields (logo, userAvatar) are excluded — those stay in localStorage.

create table if not exists public.org_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  settings        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id)
);

alter table public.org_settings enable row level security;

-- Any org member can read settings
create policy "org_read_settings" on public.org_settings
  for select using (
    exists (select 1 from public.profiles where user_id = auth.uid() and organization_id = org_settings.organization_id)
  );

-- Admins and managers can write
create policy "org_write_settings" on public.org_settings
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
      and organization_id = org_settings.organization_id
      and role in ('admin', 'manager', 'super_admin')
    )
  );
