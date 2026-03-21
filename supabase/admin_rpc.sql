-- ── Admin RPC functions (security definer — bypass RLS for super_admins) ─────

-- Search all organizations by name (super_admin only)
create or replace function public.admin_search_orgs(search_term text)
returns table (
  id uuid, name text, slug text, subscription_tier text,
  subscription_status text, created_at timestamptz
)
language sql
security definer
stable
as $$
  select id, name, slug, subscription_tier, subscription_status, created_at
  from public.organizations
  where
    name ilike '%' || search_term || '%'
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'super_admin'
    )
  order by name
  limit 20;
$$;

grant execute on function public.admin_search_orgs(text) to authenticated;

-- Get all users in an org (super_admin only)
create or replace function public.admin_get_org_users(org_id uuid)
returns table (
  id uuid, user_id uuid, full_name text, email text,
  role text, created_at timestamptz, is_active boolean
)
language sql
security definer
stable
as $$
  select id, user_id, full_name, email, role, created_at, is_active
  from public.profiles
  where
    organization_id = org_id
    and exists (
      select 1 from public.profiles p2
      where p2.user_id = auth.uid() and p2.role = 'super_admin'
    )
  order by created_at;
$$;

grant execute on function public.admin_get_org_users(uuid) to authenticated;

-- Get support notes for an org (super_admin only)
create or replace function public.admin_get_org_notes(org_id uuid)
returns table (
  id uuid, org_id uuid, admin_id uuid, note text, created_at timestamptz
)
language sql
security definer
stable
as $$
  select id, org_id, admin_id, note, created_at
  from public.org_support_notes
  where
    org_support_notes.org_id = admin_get_org_notes.org_id
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'super_admin'
    )
  order by created_at desc;
$$;

grant execute on function public.admin_get_org_notes(uuid) to authenticated;

-- Get flag for an org (super_admin only)
create or replace function public.admin_get_org_flag(org_id uuid)
returns text
language sql
security definer
stable
as $$
  select flag from public.org_flags
  where
    org_flags.org_id = admin_get_org_flag.org_id
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'super_admin'
    );
$$;

grant execute on function public.admin_get_org_flag(uuid) to authenticated;

-- Get all orgs for billing (super_admin only)
create or replace function public.admin_get_all_orgs()
returns table (
  id uuid, name text, slug text, subscription_tier text,
  subscription_status text, trial_ends_at timestamptz,
  stripe_customer_id text, stripe_subscription_id text,
  created_at timestamptz, custom_admin_price numeric,
  custom_seat_price numeric, custom_price_override boolean
)
language sql
security definer
stable
as $$
  select id, name, slug, subscription_tier, subscription_status,
    trial_ends_at, stripe_customer_id, stripe_subscription_id,
    created_at, custom_admin_price, custom_seat_price, custom_price_override
  from public.organizations
  where exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'super_admin'
  )
  order by created_at desc;
$$;

grant execute on function public.admin_get_all_orgs() to authenticated;

-- Get trialing orgs (super_admin only)
create or replace function public.admin_get_trialing_orgs()
returns table (
  id uuid, name text, slug text, subscription_tier text,
  subscription_status text, trial_ends_at timestamptz, created_at timestamptz
)
language sql
security definer
stable
as $$
  select id, name, slug, subscription_tier, subscription_status,
    trial_ends_at, created_at
  from public.organizations
  where
    subscription_status = 'trialing'
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'super_admin'
    )
  order by trial_ends_at asc;
$$;

grant execute on function public.admin_get_trialing_orgs() to authenticated;
