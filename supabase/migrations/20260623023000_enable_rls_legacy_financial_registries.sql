alter table if exists public.legacy_financial_registries enable row level security;

drop policy if exists "legacy financial registries service role access"
on public.legacy_financial_registries;

create policy "legacy financial registries service role access"
on public.legacy_financial_registries
for all
to service_role
using (true)
with check (true);

drop policy if exists "legacy financial registries tenant read access"
on public.legacy_financial_registries;

create policy "legacy financial registries tenant read access"
on public.legacy_financial_registries
for select
to authenticated
using (
  public.current_user_is_superadmin()
  or tenant_id = any(public.current_user_tenant_ids())
);

