-- ── Checklist categories per org ─────────────────────────────────────────────
-- Stores org-specific category list (additions + hidden built-ins).

create table if not exists public.checklist_categories (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  custom_cats     text[] not null default '{}',   -- custom categories added by admin
  hidden_cats     text[] not null default '{}',   -- built-in categories hidden by admin
  updated_at      timestamptz not null default now()
);

alter table public.checklist_categories enable row level security;

-- Org members can read
create policy "org_read_checklist_cats" on public.checklist_categories
  for select using (
    exists (select 1 from public.profiles where user_id = auth.uid() and organization_id = checklist_categories.organization_id)
  );

-- Admins/managers can write
create policy "org_write_checklist_cats" on public.checklist_categories
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
      and organization_id = checklist_categories.organization_id
      and role in ('admin', 'manager', 'super_admin')
    )
  );
