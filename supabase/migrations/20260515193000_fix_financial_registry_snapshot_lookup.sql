create or replace function public.get_legacy_financial_registry_snapshot(
  legacy_emp_id text,
  registry_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  normalized_registry_name text;
  registry_row public.legacy_financial_registries;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  normalized_registry_name := coalesce(nullif(trim(registry_name), ''), '');
  if normalized_registry_name = '' then
    raise exception 'registry_name_required';
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
    into registry_row
    from public.legacy_financial_registries as financial_registry
   where financial_registry.tenant_id = tenant_match.id
     and financial_registry.registry_name = normalized_registry_name
   limit 1;

  if registry_row.id is null then
    return jsonb_build_object(
      'registryName', normalized_registry_name,
      'records', '[]'::jsonb,
      'recordCount', 0,
      'updatedAt', null,
      'metadata', '{}'::jsonb
    );
  end if;

  return jsonb_build_object(
    'registryName', registry_row.registry_name,
    'records', registry_row.records,
    'recordCount', registry_row.record_count,
    'updatedAt', registry_row.updated_at,
    'metadata', registry_row.metadata
  );
end;
$$;
