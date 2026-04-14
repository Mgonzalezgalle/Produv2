create or replace function public.platform_foundation_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'phase', 'phase_1_foundation',
    'tables', jsonb_build_array(
      'tenants',
      'profiles',
      'tenant_users',
      'roles',
      'role_permissions',
      'audit_logs',
      'integration_credentials'
    ),
    'rpcs', jsonb_build_array(
      'platform_foundation_status',
      'request_tenant_bootstrap',
      'get_bsale_sync_status'
    ),
    'timestamp', timezone('utc', now())
  );
$$;

create or replace function public.request_tenant_bootstrap(
  company_draft jsonb default '{}'::jsonb,
  requested_modules jsonb default '[]'::jsonb,
  customer_type text default 'productora',
  team_size text default '1-3'
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  next_tenant public.tenants;
  draft_name text;
  draft_email text;
  requested jsonb;
  generated_code text;
begin
  draft_name := coalesce(nullif(trim(company_draft->>'nombre'), ''), 'Nueva Empresa');
  draft_email := coalesce(nullif(trim(company_draft->>'ema'), ''), '');
  requested := case
    when jsonb_typeof(requested_modules) = 'array' then requested_modules
    else '[]'::jsonb
  end;
  generated_code := 'T-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');

  insert into public.tenants (
    tenant_code,
    legal_name,
    brand_name,
    rut,
    billing_email,
    phone,
    address,
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
    generated_code,
    draft_name,
    draft_name,
    coalesce(company_draft->>'rut', ''),
    draft_email,
    coalesce(company_draft->>'tel', ''),
    coalesce(company_draft->>'dir', ''),
    coalesce(nullif(company_draft->>'color', ''), '#00d4e8'),
    'draft',
    coalesce(nullif(customer_type, ''), 'productora'),
    coalesce(nullif(team_size, ''), '1-3'),
    'UF',
    coalesce(nullif(company_draft->>'billingMonthly', '')::numeric, 0),
    'Pendiente',
    true,
    false,
    'self_serve',
    requested,
    '[]'::jsonb,
    jsonb_build_object(
      'referredByEmpId', coalesce(company_draft->>'referredByEmpId', ''),
      'referredByName', coalesce(company_draft->>'referredByName', ''),
      'referred', coalesce((company_draft->>'referred')::boolean, false),
      'contractOwner', coalesce(company_draft->>'contractOwner', '')
    )
  )
  returning * into next_tenant;

  return next_tenant;
end;
$$;

create or replace function public.get_bsale_sync_status(document_id text default '')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when coalesce(document_id, '') = '' then jsonb_build_object(
      'ok', false,
      'error', 'document_id_required'
    )
    else jsonb_build_object(
      'ok', false,
      'error', 'bsale_sync_not_persisted_yet',
      'documentId', document_id
    )
  end;
$$;

grant execute on function public.platform_foundation_status() to anon, authenticated, service_role;
grant execute on function public.request_tenant_bootstrap(jsonb, jsonb, text, text) to anon, authenticated, service_role;
grant execute on function public.get_bsale_sync_status(text) to anon, authenticated, service_role;
