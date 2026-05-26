create or replace function public.upsert_legacy_integration_credential_secret(
  legacy_emp_id text,
  provider_name text,
  environment_name text default 'tenant',
  status_name text default 'draft',
  secret_value text default '',
  clear_secret boolean default false,
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
  normalized_secret_value text;
  next_secret_ref text;
  next_metadata jsonb;
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
  normalized_secret_value := coalesce(secret_value, '');

  select *
    into tenant_match
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if tenant_match.id is null then
    raise exception 'tenant_not_found';
  end if;

  select *
    into next_record
    from public.integration_credentials
   where tenant_id = tenant_match.id
     and provider = normalized_provider
     and environment = normalized_environment
   limit 1;

  next_secret_ref := case
    when clear_secret then ''
    when trim(normalized_secret_value) <> '' then normalized_provider || ':' || normalized_environment || ':server_side'
    else coalesce(next_record.secret_ref, '')
  end;

  next_metadata := coalesce(next_record.metadata, '{}'::jsonb)
    || coalesce(metadata_data, '{}'::jsonb)
    || jsonb_build_object(
      'legacyEmpId', legacy_emp_id,
      'source', 'tenant_admin_secure',
      'secretConfigured', next_secret_ref <> '',
      'secretUpdatedAt', case when trim(normalized_secret_value) <> '' or clear_secret then timezone('utc', now()) else coalesce(next_record.updated_at, timezone('utc', now())) end
    );

  if clear_secret then
    next_metadata := next_metadata - 'secretValue';
  elsif trim(normalized_secret_value) <> '' then
    next_metadata := next_metadata || jsonb_build_object('secretValue', normalized_secret_value);
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
    next_secret_ref,
    coalesce(config_data, '{}'::jsonb),
    next_metadata
  )
  on conflict (tenant_id, provider, environment)
  do update set
    status = excluded.status,
    secret_ref = excluded.secret_ref,
    config = excluded.config,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now())
  returning * into next_record;

  perform public.append_legacy_sync_audit_log(
    legacy_emp_id,
    'integration_credential_secret_upserted',
    'integration_credential',
    normalized_provider || ':' || normalized_environment,
    jsonb_build_object(
      'provider', normalized_provider,
      'environment', normalized_environment,
      'status', normalized_status,
      'secretConfigured', next_record.secret_ref <> '',
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

create or replace function public.get_legacy_integration_credential_secret(
  legacy_emp_id text,
  provider_name text,
  environment_name text default 'tenant'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  credential public.integration_credentials;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
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
    into credential
    from public.integration_credentials
   where tenant_id = tenant_match.id
     and provider = coalesce(nullif(trim(provider_name), ''), '')
     and environment = coalesce(nullif(trim(environment_name), ''), 'tenant')
   limit 1;

  if credential.id is null then
    return jsonb_build_object('ok', false, 'error', 'credential_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'provider', credential.provider,
    'environment', credential.environment,
    'status', credential.status,
    'secretConfigured', coalesce(nullif(credential.secret_ref, ''), '') <> '',
    'secretValue', coalesce(credential.metadata->>'secretValue', ''),
    'config', coalesce(credential.config, '{}'::jsonb),
    'updatedAt', credential.updated_at
  );
end;
$$;

grant execute on function public.upsert_legacy_integration_credential_secret(text, text, text, text, text, boolean, jsonb, jsonb) to authenticated, service_role;
revoke all on function public.get_legacy_integration_credential_secret(text, text, text) from public, anon, authenticated;
grant execute on function public.get_legacy_integration_credential_secret(text, text, text) to service_role;
