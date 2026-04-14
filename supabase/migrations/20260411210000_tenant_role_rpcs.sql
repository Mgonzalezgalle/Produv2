create or replace function public.get_legacy_tenant_custom_roles(
  legacy_emp_id text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with tenant_match as (
    select id
      from public.tenants
     where metadata->>'legacyEmpId' = legacy_emp_id
     limit 1
  ),
  role_rows as (
    select
      r.role_key,
      r.label,
      r.color,
      r.badge,
      coalesce(
        jsonb_agg(rp.permission_key order by rp.permission_key) filter (where rp.permission_key is not null),
        '[]'::jsonb
      ) as permissions
    from public.roles r
    join tenant_match tm on tm.id = r.tenant_id
    left join public.role_permissions rp on rp.role_id = r.id
    where r.is_system = false
    group by r.id, r.role_key, r.label, r.color, r.badge
    order by r.label
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', role_key,
        'label', label,
        'color', color,
        'badge', badge,
        'permissions', permissions
      )
    ),
    '[]'::jsonb
  )
  from role_rows;
$$;

create or replace function public.upsert_legacy_tenant_role(
  legacy_emp_id text,
  role_key text,
  role_label text,
  role_color text default '#7c7c8a',
  role_badge text default 'gray',
  permission_keys jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  target_role public.roles;
  perm text;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;
  if coalesce(trim(role_key), '') = '' then
    raise exception 'role_key_required';
  end if;
  if coalesce(trim(role_label), '') = '' then
    raise exception 'role_label_required';
  end if;

  select *
    into tenant_match
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if tenant_match.id is null then
    raise exception 'tenant_not_found';
  end if;

  insert into public.roles (
    tenant_id,
    role_key,
    label,
    color,
    badge,
    is_system
  ) values (
    tenant_match.id,
    role_key,
    role_label,
    coalesce(nullif(role_color, ''), '#7c7c8a'),
    coalesce(nullif(role_badge, ''), 'gray'),
    false
  )
  on conflict (tenant_id, role_key)
  do update set
    label = excluded.label,
    color = excluded.color,
    badge = excluded.badge
  returning * into target_role;

  delete from public.role_permissions
   where role_id = target_role.id;

  if jsonb_typeof(permission_keys) = 'array' then
    for perm in
      select jsonb_array_elements_text(permission_keys)
    loop
      insert into public.role_permissions (role_id, permission_key)
      values (target_role.id, perm)
      on conflict (role_id, permission_key) do nothing;
    end loop;
  end if;

  return public.get_legacy_tenant_custom_roles(legacy_emp_id);
end;
$$;

create or replace function public.delete_legacy_tenant_role(
  legacy_emp_id text,
  role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  target_role public.roles;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;
  if coalesce(trim(role_key), '') = '' then
    raise exception 'role_key_required';
  end if;

  select *
    into tenant_match
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if tenant_match.id is null then
    raise exception 'tenant_not_found';
  end if;

  select *
    into target_role
    from public.roles
   where tenant_id = tenant_match.id
     and role_key = delete_legacy_tenant_role.role_key
     and is_system = false
   limit 1;

  if target_role.id is not null then
    delete from public.roles where id = target_role.id;
  end if;

  return public.get_legacy_tenant_custom_roles(legacy_emp_id);
end;
$$;

grant execute on function public.get_legacy_tenant_custom_roles(text) to anon, authenticated, service_role;
grant execute on function public.upsert_legacy_tenant_role(text, text, text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.delete_legacy_tenant_role(text, text) to anon, authenticated, service_role;
