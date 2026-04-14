create table if not exists public.identity_promotion_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legacy_user_id text not null,
  email text not null default '',
  full_name text not null default '',
  target_role_key text not null default 'viewer',
  plan_status text not null default 'draft',
  readiness_score integer not null default 0,
  missing_requirements jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, legacy_user_id)
);

create index if not exists idx_identity_promotion_plans_tenant_id on public.identity_promotion_plans(tenant_id);
create index if not exists idx_identity_promotion_plans_status on public.identity_promotion_plans(plan_status);

drop trigger if exists identity_promotion_plans_touch_updated_at on public.identity_promotion_plans;
create trigger identity_promotion_plans_touch_updated_at
before update on public.identity_promotion_plans
for each row execute function public.touch_updated_at();

alter table public.identity_promotion_plans enable row level security;

create policy "temporary deny identity_promotion_plans"
on public.identity_promotion_plans
for all
using (false)
with check (false);

create or replace function public.plan_legacy_identity_promotions(
  legacy_emp_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  custom_roles_data jsonb;
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

  custom_roles_data := public.get_legacy_tenant_custom_roles(legacy_emp_id);

  delete from public.identity_promotion_plans
   where tenant_id = tenant_match.id;

  insert into public.identity_promotion_plans (
    tenant_id,
    legacy_user_id,
    email,
    full_name,
    target_role_key,
    plan_status,
    readiness_score,
    missing_requirements,
    source_snapshot
  )
  with valid_roles as (
    select unnest(array['viewer','productor','comercial','admin']) as role_key
    union
    select jsonb_array_elements(custom_roles_data)->>'key'
  ),
  candidate_rows as (
    select
      ic.tenant_id,
      ic.legacy_user_id,
      coalesce(nullif(ic.email, ''), nullif(lus.email, ''), '') as resolved_email,
      coalesce(nullif(ic.full_name, ''), nullif(lus.full_name, ''), '') as resolved_name,
      ic.target_role_key,
      ic.status as candidate_status,
      ic.is_crew,
      ic.crew_role,
      lus.legacy_user_id as shadow_user_id,
      lus.active as shadow_active,
      exists (
        select 1
        from valid_roles vr
        where vr.role_key = ic.target_role_key
      ) as role_ready
    from public.identity_candidates ic
    left join public.legacy_user_shadows lus
      on lus.tenant_id = ic.tenant_id
     and lus.legacy_user_id = ic.legacy_user_id
    where ic.tenant_id = tenant_match.id
  ),
  normalized as (
    select
      tenant_id,
      legacy_user_id,
      resolved_email,
      resolved_name,
      target_role_key,
      candidate_status,
      is_crew,
      crew_role,
      shadow_user_id,
      shadow_active,
      role_ready,
      to_jsonb(array_remove(array[
          case when coalesce(trim(resolved_email), '') = '' then 'missing_email' end,
          case when coalesce(trim(resolved_name), '') = '' then 'missing_name' end,
          case when shadow_user_id is null then 'missing_shadow' end,
          case when not role_ready then 'unresolved_role' end
        ]::text[], null)) as raw_missing
    from candidate_rows
  ),
  planned as (
    select
      tenant_id,
      legacy_user_id,
      resolved_email,
      resolved_name,
      target_role_key,
      case when jsonb_array_length(raw_missing) = 0 then 'ready' else 'incomplete' end as plan_status,
      (
        case when coalesce(trim(resolved_email), '') <> '' then 1 else 0 end +
        case when coalesce(trim(resolved_name), '') <> '' then 1 else 0 end +
        case when shadow_user_id is not null then 1 else 0 end +
        case when role_ready then 1 else 0 end
      ) as readiness_score,
      raw_missing as missing_requirements,
      jsonb_build_object(
        'candidateStatus', candidate_status,
        'shadowFound', shadow_user_id is not null,
        'shadowActive', coalesce(shadow_active, false),
        'isCrew', is_crew,
        'crewRole', crew_role
      ) as source_snapshot
    from normalized
  )
  select
    tenant_id,
    legacy_user_id,
    resolved_email,
    resolved_name,
    target_role_key,
    plan_status,
    readiness_score,
    missing_requirements,
    source_snapshot
  from planned;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', ipp.legacy_user_id,
        'email', ipp.email,
        'name', ipp.full_name,
        'role', ipp.target_role_key,
        'status', ipp.plan_status,
        'readinessScore', ipp.readiness_score,
        'missingRequirements', ipp.missing_requirements,
        'sourceSnapshot', ipp.source_snapshot
      )
      order by ipp.plan_status desc, ipp.readiness_score desc, ipp.full_name
    )
    from public.identity_promotion_plans ipp
    where ipp.tenant_id = tenant_match.id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.plan_legacy_identity_promotions(text) to anon, authenticated, service_role;

create or replace function public.get_legacy_tenant_platform_snapshot(
  legacy_emp_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  roles_data jsonb;
  users_data jsonb;
  identities_data jsonb;
  plans_data jsonb;
  audit_data jsonb;
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

  roles_data := public.get_legacy_tenant_custom_roles(legacy_emp_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', lus.legacy_user_id,
        'name', lus.full_name,
        'email', lus.email,
        'role', lus.role_key,
        'active', lus.active,
        'isCrew', lus.is_crew,
        'crewRole', lus.crew_role
      )
      order by lus.full_name
    ),
    '[]'::jsonb
  )
  into users_data
  from public.legacy_user_shadows lus
  where lus.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ic.legacy_user_id,
        'email', ic.email,
        'name', ic.full_name,
        'role', ic.target_role_key,
        'status', ic.status,
        'isCrew', ic.is_crew,
        'crewRole', ic.crew_role
      )
      order by ic.full_name
    ),
    '[]'::jsonb
  )
  into identities_data
  from public.identity_candidates ic
  where ic.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ipp.legacy_user_id,
        'email', ipp.email,
        'name', ipp.full_name,
        'role', ipp.target_role_key,
        'status', ipp.plan_status,
        'readinessScore', ipp.readiness_score,
        'missingRequirements', ipp.missing_requirements,
        'sourceSnapshot', ipp.source_snapshot
      )
      order by ipp.plan_status desc, ipp.readiness_score desc, ipp.full_name
    ),
    '[]'::jsonb
  )
  into plans_data
  from public.identity_promotion_plans ipp
  where ipp.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action', al.action,
        'entityType', al.entity_type,
        'entityId', al.entity_id,
        'payload', al.payload,
        'createdAt', al.created_at
      )
      order by al.created_at desc
    ),
    '[]'::jsonb
  )
  into audit_data
  from (
    select *
    from public.audit_logs
    where tenant_id = tenant_match.id
    order by created_at desc
    limit 12
  ) al;

  return jsonb_build_object(
    'tenant', to_jsonb(tenant_match),
    'customRoles', coalesce(roles_data, '[]'::jsonb),
    'userShadows', coalesce(users_data, '[]'::jsonb),
    'identityCandidates', coalesce(identities_data, '[]'::jsonb),
    'promotionPlans', coalesce(plans_data, '[]'::jsonb),
    'auditLogs', coalesce(audit_data, '[]'::jsonb)
  );
end;
$$;
