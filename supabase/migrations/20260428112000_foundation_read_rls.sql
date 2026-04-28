create or replace function public.current_profile_global_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select p.global_role
        from public.profiles p
       where p.id = auth.uid()
       limit 1
    ),
    ''
  );
$$;

create or replace function public.current_user_tenant_ids()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    array(
      select tu.tenant_id
        from public.tenant_users tu
       where tu.user_id = auth.uid()
         and tu.status = 'active'
    ),
    '{}'::uuid[]
  );
$$;

create or replace function public.current_user_is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_global_role() = 'superadmin';
$$;

create or replace function public.current_user_is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.tenant_users tu
      left join public.roles r
        on r.id = tu.role_id
     where tu.user_id = auth.uid()
       and tu.tenant_id = target_tenant_id
       and tu.status = 'active'
       and (
         public.current_user_is_superadmin()
         or tu.is_primary_admin = true
         or coalesce(r.role_key, '') = 'admin'
         or public.current_profile_global_role() = 'admin'
       )
  );
$$;

grant execute on function public.current_profile_global_role() to authenticated, service_role;
grant execute on function public.current_user_tenant_ids() to authenticated, service_role;
grant execute on function public.current_user_is_superadmin() to authenticated, service_role;
grant execute on function public.current_user_is_tenant_admin(uuid) to authenticated, service_role;

drop policy if exists "temporary deny tenants" on public.tenants;
drop policy if exists "temporary deny profiles" on public.profiles;
drop policy if exists "temporary deny roles" on public.roles;
drop policy if exists "temporary deny role_permissions" on public.role_permissions;
drop policy if exists "temporary deny tenant_users" on public.tenant_users;
drop policy if exists "temporary deny audit_logs" on public.audit_logs;

create policy "tenant read access"
on public.tenants
for select
to authenticated
using (
  public.current_user_is_superadmin()
  or id = any(public.current_user_tenant_ids())
);

create policy "profile self or tenant read access"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_is_superadmin()
  or exists (
    select 1
      from public.tenant_users current_membership
      join public.tenant_users target_membership
        on target_membership.tenant_id = current_membership.tenant_id
     where current_membership.user_id = auth.uid()
       and current_membership.status = 'active'
       and target_membership.user_id = profiles.id
       and target_membership.status = 'active'
  )
);

create policy "tenant role read access"
on public.roles
for select
to authenticated
using (
  public.current_user_is_superadmin()
  or tenant_id = any(public.current_user_tenant_ids())
);

create policy "tenant role permission read access"
on public.role_permissions
for select
to authenticated
using (
  public.current_user_is_superadmin()
  or exists (
    select 1
      from public.roles r
     where r.id = role_permissions.role_id
       and r.tenant_id = any(public.current_user_tenant_ids())
  )
);

create policy "tenant membership read access"
on public.tenant_users
for select
to authenticated
using (
  public.current_user_is_superadmin()
  or tenant_id = any(public.current_user_tenant_ids())
  or user_id = auth.uid()
);

create policy "tenant audit read access"
on public.audit_logs
for select
to authenticated
using (
  public.current_user_is_superadmin()
  or (tenant_id is not null and tenant_id = any(public.current_user_tenant_ids()))
  or actor_user_id = auth.uid()
);
