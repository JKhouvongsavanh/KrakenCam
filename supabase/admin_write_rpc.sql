-- ── Admin write RPCs (super_admin only) ──────────────────────────────────────

-- Extend a trial
create or replace function public.admin_extend_trial(
  p_org_id uuid,
  p_new_end timestamptz,
  p_days int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_is_admin boolean;
begin
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'super_admin') into v_is_admin;
  if not v_is_admin then raise exception 'Forbidden'; end if;
  update organizations set trial_ends_at = p_new_end where id = p_org_id;
  insert into audit_log (event_type, target_org_id, details)
  values ('trial.extended', p_org_id, jsonb_build_object('extended_by_days', p_days, 'new_end', p_new_end));
end;
$$;
grant execute on function public.admin_extend_trial(uuid, timestamptz, int) to authenticated;

-- Convert trial to paid
create or replace function public.admin_convert_trial(p_org_id uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_is_admin boolean;
begin
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'super_admin') into v_is_admin;
  if not v_is_admin then raise exception 'Forbidden'; end if;
  update organizations set subscription_status = 'active', trial_ends_at = null where id = p_org_id;
  insert into audit_log (event_type, target_org_id, details)
  values ('trial.converted_to_paid', p_org_id, jsonb_build_object('tier', p_tier));
end;
$$;
grant execute on function public.admin_convert_trial(uuid, text) to authenticated;

-- Add support note
create or replace function public.admin_add_org_note(p_org_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_is_admin boolean;
begin
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'super_admin') into v_is_admin;
  if not v_is_admin then raise exception 'Forbidden'; end if;
  insert into org_support_notes (org_id, note) values (p_org_id, p_note);
end;
$$;
grant execute on function public.admin_add_org_note(uuid, text) to authenticated;

-- Set org flag
create or replace function public.admin_set_org_flag(p_org_id uuid, p_flag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_is_admin boolean;
begin
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'super_admin') into v_is_admin;
  if not v_is_admin then raise exception 'Forbidden'; end if;
  insert into org_flags (org_id, flag) values (p_org_id, p_flag)
  on conflict (org_id) do update set flag = p_flag, updated_at = now();
end;
$$;
grant execute on function public.admin_set_org_flag(uuid, text) to authenticated;
