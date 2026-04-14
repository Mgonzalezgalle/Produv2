create or replace function public.sync_legacy_tenant_snapshot(
  legacy_emp_id text,
  tenant_snapshot jsonb default '{}'::jsonb
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_tenant public.tenants;
  synced_tenant public.tenants;
  snapshot_name text;
  snapshot_code text;
  snapshot_rut text;
  snapshot_addons jsonb;
  snapshot_requested_modules jsonb;
  snapshot_metadata jsonb;
begin
  if coalesce(trim(legacy_emp_id), '') = '' then
    raise exception 'legacy_emp_id_required';
  end if;

  snapshot_name := coalesce(
    nullif(trim(tenant_snapshot->>'nombre'), ''),
    nullif(trim(tenant_snapshot->>'brandName'), ''),
    'Tenant sincronizado'
  );
  snapshot_code := coalesce(
    nullif(trim(tenant_snapshot->>'tenantCode'), ''),
    'LEGACY-' || upper(substr(md5(legacy_emp_id), 1, 6))
  );
  snapshot_rut := coalesce(nullif(trim(tenant_snapshot->>'rut'), ''), '');
  snapshot_addons := case
    when jsonb_typeof(tenant_snapshot->'addons') = 'array' then tenant_snapshot->'addons'
    else '[]'::jsonb
  end;
  snapshot_requested_modules := case
    when jsonb_typeof(tenant_snapshot->'requestedModules') = 'array' then tenant_snapshot->'requestedModules'
    else snapshot_addons
  end;
  snapshot_metadata := coalesce(tenant_snapshot->'metadata', '{}'::jsonb)
    || jsonb_build_object(
      'legacyEmpId', legacy_emp_id,
      'syncSource', 'lab_local',
      'lastLegacySyncAt', timezone('utc', now())
    );

  select *
    into existing_tenant
    from public.tenants
   where metadata->>'legacyEmpId' = legacy_emp_id
   limit 1;

  if existing_tenant.id is null and snapshot_code <> '' then
    select *
      into existing_tenant
      from public.tenants
     where tenant_code = snapshot_code
     limit 1;
  end if;

  if existing_tenant.id is null and snapshot_rut <> '' then
    select *
      into existing_tenant
      from public.tenants
     where rut = snapshot_rut
     limit 1;
  end if;

  if existing_tenant.id is null then
    insert into public.tenants (
      tenant_code,
      legal_name,
      brand_name,
      rut,
      billing_email,
      phone,
      address,
      logo_url,
      primary_color,
      status,
      customer_type,
      team_size,
      billing_currency,
      billing_monthly,
      billing_status,
      pending_activation,
      active,
      request_type,
      requested_modules,
      addons,
      metadata
    ) values (
      snapshot_code,
      snapshot_name,
      coalesce(nullif(trim(tenant_snapshot->>'brandName'), ''), snapshot_name),
      snapshot_rut,
      coalesce(tenant_snapshot->>'ema', ''),
      coalesce(tenant_snapshot->>'tel', ''),
      coalesce(tenant_snapshot->>'dir', ''),
      coalesce(tenant_snapshot->>'logo', ''),
      coalesce(nullif(tenant_snapshot->>'primaryColor', ''), '#00d4e8'),
      case when coalesce((tenant_snapshot->>'active')::boolean, true) then 'active' else 'draft' end,
      coalesce(nullif(tenant_snapshot->>'customerType', ''), 'productora'),
      coalesce(nullif(tenant_snapshot->>'teamSize', ''), '1-3'),
      coalesce(nullif(tenant_snapshot->>'billingCurrency', ''), 'UF'),
      coalesce(nullif(tenant_snapshot->>'billingMonthly', '')::numeric, 0),
      coalesce(nullif(tenant_snapshot->>'billingStatus', ''), 'Pendiente'),
      false,
      coalesce((tenant_snapshot->>'active')::boolean, true),
      'legacy_sync',
      snapshot_requested_modules,
      snapshot_addons,
      snapshot_metadata
    )
    returning * into synced_tenant;
  else
    update public.tenants
       set tenant_code = coalesce(nullif(snapshot_code, ''), existing_tenant.tenant_code),
           legal_name = snapshot_name,
           brand_name = coalesce(nullif(trim(tenant_snapshot->>'brandName'), ''), snapshot_name),
           rut = coalesce(snapshot_rut, existing_tenant.rut),
           billing_email = coalesce(tenant_snapshot->>'ema', existing_tenant.billing_email),
           phone = coalesce(tenant_snapshot->>'tel', existing_tenant.phone),
           address = coalesce(tenant_snapshot->>'dir', existing_tenant.address),
           logo_url = coalesce(tenant_snapshot->>'logo', existing_tenant.logo_url),
           primary_color = coalesce(nullif(tenant_snapshot->>'primaryColor', ''), existing_tenant.primary_color),
           status = case
             when coalesce((tenant_snapshot->>'active')::boolean, existing_tenant.active) then 'active'
             else existing_tenant.status
           end,
           customer_type = coalesce(nullif(tenant_snapshot->>'customerType', ''), existing_tenant.customer_type),
           team_size = coalesce(nullif(tenant_snapshot->>'teamSize', ''), existing_tenant.team_size),
           billing_currency = coalesce(nullif(tenant_snapshot->>'billingCurrency', ''), existing_tenant.billing_currency),
           billing_monthly = coalesce(nullif(tenant_snapshot->>'billingMonthly', '')::numeric, existing_tenant.billing_monthly),
           billing_status = coalesce(nullif(tenant_snapshot->>'billingStatus', ''), existing_tenant.billing_status),
           pending_activation = false,
           active = coalesce((tenant_snapshot->>'active')::boolean, existing_tenant.active),
           request_type = 'legacy_sync',
           requested_modules = snapshot_requested_modules,
           addons = snapshot_addons,
           metadata = coalesce(existing_tenant.metadata, '{}'::jsonb) || snapshot_metadata
     where id = existing_tenant.id
     returning * into synced_tenant;
  end if;

  return synced_tenant;
end;
$$;

grant execute on function public.sync_legacy_tenant_snapshot(text, jsonb) to anon, authenticated, service_role;
