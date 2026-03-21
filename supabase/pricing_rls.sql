-- Allow anyone (anon + authenticated) to read pricing_config
-- Prices are public info shown on the pricing page
create policy "public_read_pricing" on public.pricing_config
  for select using (true);

-- Allow authenticated super_admins to update pricing
create policy "super_admin_write_pricing" on public.pricing_config
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'super_admin'
    )
  );
