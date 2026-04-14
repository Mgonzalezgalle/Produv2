drop function if exists public.upsert_legacy_tenant_role(text, text, text, text, text, jsonb);
create or replace function public.upsert_legacy_tenant_role(
  legacy_emp_id text,
  p_role_key text,
  p_role_label text,
  p_role_color text default '#7c7c8a',
  p_role_badge text default 'gray',
  p_permission_keys jsonb default '[]'::jsonb
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
  if coalesce(trim(p_role_key), '') = '' then
    raise exception 'role_key_required';
  end if;
  if coalesce(trim(p_role_label), '') = '' then
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
    p_role_key,
    p_role_label,
    coalesce(nullif(p_role_color, ''), '#7c7c8a'),
    coalesce(nullif(p_role_badge, ''), 'gray'),
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

  if jsonb_typeof(p_permission_keys) = 'array' then
    for perm in
      select jsonb_array_elements_text(p_permission_keys)
    loop
      insert into public.role_permissions (role_id, permission_key)
      values (target_role.id, perm)
      on conflict (role_id, permission_key) do nothing;
    end loop;
  end if;

  return public.get_legacy_tenant_custom_roles(legacy_emp_id);
end;
$$;

drop function if exists public.delete_legacy_tenant_role(text, text);
create or replace function public.delete_legacy_tenant_role(
  legacy_emp_id text,
  p_role_key text
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
  if coalesce(trim(p_role_key), '') = '' then
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
    from public.roles r
   where r.tenant_id = tenant_match.id
     and r.role_key = p_role_key
     and r.is_system = false
   limit 1;

  if target_role.id is not null then
    delete from public.roles where id = target_role.id;
  end if;

  return public.get_legacy_tenant_custom_roles(legacy_emp_id);
end;
$$;
