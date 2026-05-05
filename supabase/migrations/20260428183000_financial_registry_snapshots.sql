create table if not exists public.legacy_financial_registries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  registry_name text not null,
  records jsonb not null default '[]'::jsonb,
  record_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, registry_name)
);

create index if not exists legacy_financial_registries_tenant_registry_idx
  on public.legacy_financial_registries (tenant_id, registry_name);

create or replace function public.upsert_legacy_financial_registry_snapshot(
  legacy_emp_id text,
  registry_name text,
  records_data jsonb default '[]'::jsonb,
  metadata_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  next_registry public.legacy_financial_registries;
  normalized_registry_name text;
  normalized_records jsonb;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  normalized_registry_name := coalesce(nullif(trim(registry_name), ''), '');
  if normalized_registry_name = '' then
    raise exception 'registry_name_required';
  end if;

  if normalized_registry_name not in ('receipts', 'disbursements', 'invoices') then
    raise exception 'unsupported_registry_name';
  end if;

  normalized_records := case
    when jsonb_typeof(coalesce(records_data, '[]'::jsonb)) = 'array' then coalesce(records_data, '[]'::jsonb)
    else '[]'::jsonb
  end;

  select *
    into tenant_match
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if tenant_match.id is null then
    raise exception 'tenant_not_found';
  end if;

  insert into public.legacy_financial_registries (
    tenant_id,
    registry_name,
    records,
    record_count,
    metadata
  ) values (
    tenant_match.id,
    normalized_registry_name,
    normalized_records,
    coalesce(jsonb_array_length(normalized_records), 0),
    coalesce(metadata_data, '{}'::jsonb)
      || jsonb_build_object(
        'legacyEmpId', legacy_emp_id,
        'source', 'legacy_financial_registry',
        'registryName', normalized_registry_name
      )
  )
  on conflict (tenant_id, registry_name)
  do update set
    records = excluded.records,
    record_count = excluded.record_count,
    metadata = coalesce(public.legacy_financial_registries.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = timezone('utc', now())
  returning * into next_registry;

  perform public.append_legacy_sync_audit_log(
    legacy_emp_id,
    'financial_registry_snapshot_upserted',
    'financial_registry',
    normalized_registry_name,
    jsonb_build_object(
      'registryName', normalized_registry_name,
      'recordCount', next_registry.record_count
    )
  );

  return jsonb_build_object(
    'id', next_registry.id,
    'registryName', next_registry.registry_name,
    'recordCount', next_registry.record_count,
    'updatedAt', next_registry.updated_at,
    'metadata', next_registry.metadata
  );
end;
$$;

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
    from public.legacy_financial_registries
   where tenant_id = tenant_match.id
     and registry_name = normalized_registry_name
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

grant execute on function public.upsert_legacy_financial_registry_snapshot(text, text, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.get_legacy_financial_registry_snapshot(text, text) to authenticated, service_role;
