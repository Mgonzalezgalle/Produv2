create or replace function public.upsert_legacy_financial_registry_record(
  legacy_emp_id text,
  registry_name text,
  record_data jsonb default '{}'::jsonb,
  metadata_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  registry_row public.legacy_financial_registries;
  next_registry public.legacy_financial_registries;
  normalized_registry_name text;
  normalized_record jsonb;
  normalized_records jsonb;
  target_record_id text;
  record_exists boolean;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  normalized_registry_name := coalesce(nullif(trim(registry_name), ''), '');
  if normalized_registry_name = '' then
    raise exception 'registry_name_required';
  end if;

  if normalized_registry_name not in ('receipts', 'disbursements', 'invoices', 'payables', 'purchase_orders', 'issued_orders') then
    raise exception 'unsupported_registry_name';
  end if;

  if jsonb_typeof(coalesce(record_data, '{}'::jsonb)) <> 'object' then
    raise exception 'record_data_must_be_object';
  end if;

  normalized_record := coalesce(record_data, '{}'::jsonb);
  target_record_id := coalesce(nullif(trim(normalized_record->>'id'), ''), '');
  if target_record_id = '' then
    raise exception 'record_id_required';
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

  normalized_records := case
    when jsonb_typeof(coalesce(registry_row.records, '[]'::jsonb)) = 'array' then coalesce(registry_row.records, '[]'::jsonb)
    else '[]'::jsonb
  end;

  select exists(
    select 1
      from jsonb_array_elements(normalized_records) item
     where coalesce(item->>'id', '') = target_record_id
  ) into record_exists;

  select coalesce(jsonb_agg(
    case
      when coalesce(item->>'id', '') = target_record_id then normalized_record
      else item
    end
  ), '[]'::jsonb)
    into normalized_records
    from jsonb_array_elements(normalized_records) item;

  if not record_exists then
    normalized_records := normalized_records || jsonb_build_array(normalized_record);
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
        'registryName', normalized_registry_name,
        'lastMutation', 'record_upsert',
        'mutatedRecordId', target_record_id
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
    'financial_registry_record_upserted',
    'financial_registry',
    normalized_registry_name,
    jsonb_build_object(
      'registryName', normalized_registry_name,
      'recordId', target_record_id,
      'recordCount', next_registry.record_count
    )
  );

  return jsonb_build_object(
    'registryName', next_registry.registry_name,
    'records', next_registry.records,
    'recordCount', next_registry.record_count,
    'updatedAt', next_registry.updated_at,
    'metadata', next_registry.metadata,
    'recordId', target_record_id
  );
end;
$$;

create or replace function public.delete_legacy_financial_registry_record(
  legacy_emp_id text,
  registry_name text,
  record_id text,
  metadata_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  registry_row public.legacy_financial_registries;
  next_registry public.legacy_financial_registries;
  normalized_registry_name text;
  target_record_id text;
  normalized_records jsonb;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  normalized_registry_name := coalesce(nullif(trim(registry_name), ''), '');
  if normalized_registry_name = '' then
    raise exception 'registry_name_required';
  end if;

  if normalized_registry_name not in ('receipts', 'disbursements', 'invoices', 'payables', 'purchase_orders', 'issued_orders') then
    raise exception 'unsupported_registry_name';
  end if;

  target_record_id := coalesce(nullif(trim(record_id), ''), '');
  if target_record_id = '' then
    raise exception 'record_id_required';
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

  normalized_records := case
    when jsonb_typeof(coalesce(registry_row.records, '[]'::jsonb)) = 'array' then coalesce(registry_row.records, '[]'::jsonb)
    else '[]'::jsonb
  end;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
    into normalized_records
    from jsonb_array_elements(normalized_records) item
   where coalesce(item->>'id', '') <> target_record_id;

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
        'registryName', normalized_registry_name,
        'lastMutation', 'record_deleted',
        'mutatedRecordId', target_record_id
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
    'financial_registry_record_deleted',
    'financial_registry',
    normalized_registry_name,
    jsonb_build_object(
      'registryName', normalized_registry_name,
      'recordId', target_record_id,
      'recordCount', next_registry.record_count
    )
  );

  return jsonb_build_object(
    'registryName', next_registry.registry_name,
    'records', next_registry.records,
    'recordCount', next_registry.record_count,
    'updatedAt', next_registry.updated_at,
    'metadata', next_registry.metadata,
    'recordId', target_record_id
  );
end;
$$;

grant execute on function public.upsert_legacy_financial_registry_record(text, text, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.delete_legacy_financial_registry_record(text, text, text, jsonb) to authenticated, service_role;
