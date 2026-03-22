-- ── pg_cron: Data cleanup for cancelled organizations ────────────────────────
--
-- SETUP STEPS:
-- 1. In Supabase dashboard → Database → Extensions → enable "pg_cron"
-- 2. Run this entire file in SQL Editor
--
-- WHAT IT DOES:
-- When an org cancels, Stripe webhook sets cancelled_at + data_delete_at (60 days later).
-- This cron job runs daily at 2am UTC and permanently deletes all data for orgs
-- whose data_delete_at has passed. This matches our ToS (60-day grace period).
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Create the cleanup function
create or replace function public.cleanup_cancelled_orgs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_count int := 0;
begin
  -- Find orgs past their data_delete_at date
  for v_org in
    select id, name, data_delete_at
    from organizations
    where
      subscription_status in ('cancelled', 'canceled')
      and data_delete_at is not null
      and data_delete_at < now()
  loop
    -- Log before deleting
    insert into audit_log (event_type, target_org_id, details)
    values (
      'org.data_purged',
      v_org.id,
      jsonb_build_object(
        'org_name',       v_org.name,
        'data_delete_at', v_org.data_delete_at,
        'purged_at',      now()
      )
    );

    -- Delete all org data (cascade handles child tables via FK)
    -- Order matters: delete child data first, then the org itself

    -- Profiles (users)
    delete from profiles where organization_id = v_org.id;

    -- Supabase Storage files (best-effort via storage API — not handled here,
    -- handle via Stripe webhook / edge function with service role)

    -- Delete the organization row (cascades to all FK-linked tables)
    delete from organizations where id = v_org.id;

    v_count := v_count + 1;
  end loop;

  -- Log summary if any orgs were cleaned
  if v_count > 0 then
    raise notice 'cleanup_cancelled_orgs: purged % organization(s)', v_count;
  end if;
end;
$$;

-- Allow service role to call it
grant execute on function public.cleanup_cancelled_orgs() to service_role;


-- Step 2: Schedule with pg_cron (runs daily at 2:00 AM UTC)
-- NOTE: pg_cron extension must be enabled first in Supabase → Database → Extensions
select cron.schedule(
  'cleanup-cancelled-orgs',      -- job name (unique)
  '0 2 * * *',                   -- cron expression: 2am UTC daily
  $$select public.cleanup_cancelled_orgs()$$
);


-- Step 3: Helper — set data_delete_at when an org cancels
-- Call this from the Stripe webhook when subscription.deleted fires
create or replace function public.cancel_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update organizations
  set
    subscription_status = 'cancelled',
    cancelled_at        = now(),
    data_delete_at      = now() + interval '60 days'
  where id = p_org_id;

  insert into audit_log (event_type, target_org_id, details)
  values (
    'org.cancelled',
    p_org_id,
    jsonb_build_object('cancelled_at', now(), 'data_delete_at', now() + interval '60 days')
  );
end;
$$;

grant execute on function public.cancel_organization(uuid) to service_role;


-- ── Verify setup ──────────────────────────────────────────────────────────────
-- Run these to confirm after setup:

-- Check cron jobs:
-- select * from cron.job;

-- Check scheduled runs:
-- select * from cron.job_run_details order by start_time desc limit 10;

-- Manually test the function (safe — only deletes past data_delete_at):
-- select public.cleanup_cancelled_orgs();

-- View orgs scheduled for deletion:
-- select id, name, cancelled_at, data_delete_at
-- from organizations
-- where subscription_status in ('cancelled','canceled')
-- and data_delete_at is not null
-- order by data_delete_at;
