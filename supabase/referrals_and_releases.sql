-- ── Affiliates / Referral Program ────────────────────────────────────────────

create table if not exists public.affiliates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                    -- Affiliate's name
  email         text not null unique,             -- Their contact email
  code          text not null unique,             -- Referral code e.g. "JOHN20"
  commission_pct numeric(5,2) not null default 20, -- % commission on first payment
  commission_flat numeric(10,2) default null,     -- OR flat $ per conversion
  active        boolean not null default true,
  notes         text default '',
  created_at    timestamptz not null default now(),
  total_referrals int not null default 0,
  total_conversions int not null default 0,
  total_commission_owed numeric(10,2) not null default 0,
  total_commission_paid numeric(10,2) not null default 0
);

create table if not exists public.referrals (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid references public.affiliates(id) on delete set null,
  org_id        uuid references public.organizations(id) on delete set null,
  ref_code      text not null,
  status        text not null default 'pending', -- pending | converted | paid | cancelled
  commission_amount numeric(10,2) default null,
  created_at    timestamptz not null default now(),
  converted_at  timestamptz default null,
  paid_at       timestamptz default null,
  notes         text default ''
);

alter table public.affiliates enable row level security;
alter table public.referrals  enable row level security;

create policy "super_admin_all_affiliates" on public.affiliates
  using (exists (select 1 from public.profiles where user_id = auth.uid() and role = 'super_admin'));
create policy "super_admin_all_referrals" on public.referrals
  using (exists (select 1 from public.profiles where user_id = auth.uid() and role = 'super_admin'));

-- Public read of affiliate codes (needed for signup page to validate ?ref=CODE)
create policy "public_read_affiliate_code" on public.affiliates
  for select using (active = true);

-- Store referral code on signup (called from create-org edge function)
create or replace function public.track_referral(p_ref_code text, p_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_affiliate_id uuid;
begin
  select id into v_affiliate_id from affiliates where code = upper(p_ref_code) and active = true;
  if v_affiliate_id is null then return; end if;
  insert into referrals (affiliate_id, org_id, ref_code, status)
  values (v_affiliate_id, p_org_id, upper(p_ref_code), 'pending')
  on conflict do nothing;
  update affiliates set total_referrals = total_referrals + 1 where id = v_affiliate_id;
end;
$$;
grant execute on function public.track_referral(text, uuid) to authenticated, anon;

-- ── App Versions / Release Notes ─────────────────────────────────────────────

create table if not exists public.app_versions (
  version       text primary key,          -- e.g. "1.2.0"
  title         text not null default '',  -- e.g. "Winter Update"
  release_date  date not null default current_date,
  notes         jsonb not null default '[]'::jsonb, -- array of {type, text} items
  published     boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.app_versions enable row level security;
create policy "public_read_versions" on public.app_versions for select using (published = true);
create policy "super_admin_all_versions" on public.app_versions
  using (exists (select 1 from public.profiles where user_id = auth.uid() and role = 'super_admin'));
