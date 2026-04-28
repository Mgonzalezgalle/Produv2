create or replace function public.upsert_legacy_integration_credential(
  legacy_emp_id text,
  provider_name text,
  environment_name text default 'tenant',
  status_name text default 'draft',
  secret_configured boolean default false,
  config_data jsonb default '{}'::jsonb,
  metadata_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  next_record public.integration_credentials;
  normalized_provider text;
  normalized_environment text;
  normalized_status text;
  normalized_secret_ref text;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  normalized_provider := coalesce(nullif(trim(provider_name), ''), '');
  if normalized_provider = '' then
    raise exception 'provider_name_required';
  end if;

  normalized_environment := coalesce(nullif(trim(environment_name), ''), 'tenant');
  normalized_status := coalesce(nullif(trim(status_name), ''), 'draft');
  normalized_secret_ref := case when secret_configured then 'configured_via_legacy_admin' else '' end;

  select *
    into tenant_match
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if tenant_match.id is null then
    raise exception 'tenant_not_found';
  end if;

  insert into public.integration_credentials (
    tenant_id,
    provider,
    environment,
    status,
    secret_ref,
    config,
    metadata
  ) values (
    tenant_match.id,
    normalized_provider,
    normalized_environment,
    normalized_status,
    normalized_secret_ref,
    coalesce(config_data, '{}'::jsonb),
    coalesce(metadata_data, '{}'::jsonb)
      || jsonb_build_object(
        'legacyEmpId', legacy_emp_id,
        'source', 'tenant_admin_legacy',
        'secretConfigured', secret_configured
      )
  )
  on conflict (tenant_id, provider, environment)
  do update set
    status = excluded.status,
    secret_ref = excluded.secret_ref,
    config = excluded.config,
    metadata = coalesce(public.integration_credentials.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = timezone('utc', now())
  returning * into next_record;

  perform public.append_legacy_sync_audit_log(
    legacy_emp_id,
    'integration_credential_snapshot_upserted',
    'integration_credential',
    normalized_provider || ':' || normalized_environment,
    jsonb_build_object(
      'provider', normalized_provider,
      'environment', normalized_environment,
      'status', normalized_status,
      'secretConfigured', secret_configured,
      'configKeys', (
        select coalesce(jsonb_agg(key_name order by key_name), '[]'::jsonb)
          from jsonb_object_keys(coalesce(config_data, '{}'::jsonb)) as key_name
      )
    )
  );

  return jsonb_build_object(
    'id', next_record.id,
    'provider', next_record.provider,
    'environment', next_record.environment,
    'status', next_record.status,
    'secretConfigured', coalesce(nullif(next_record.secret_ref, ''), '') <> '',
    'configKeys', (
      select coalesce(jsonb_agg(key_name order by key_name), '[]'::jsonb)
        from jsonb_object_keys(coalesce(next_record.config, '{}'::jsonb)) as key_name
    ),
    'updatedAt', next_record.updated_at
  );
end;
$$;

grant execute on function public.upsert_legacy_integration_credential(text, text, text, text, boolean, jsonb, jsonb) to authenticated, service_role;
