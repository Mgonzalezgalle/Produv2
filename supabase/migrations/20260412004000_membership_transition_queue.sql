create table if not exists public.membership_transition_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legacy_user_id text not null,
  email text not null default '',
  full_name text not null default '',
  target_role_key text not null default 'viewer',
  queue_status text not null default 'pending_profile',
  source_blueprint_status text not null default 'blocked',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, legacy_user_id)
);

create index if not exists idx_membership_transition_queue_tenant_id
  on public.membership_transition_queue(tenant_id);

drop trigger if exists membership_transition_queue_touch_updated_at on public.membership_transition_queue;
create trigger membership_transition_queue_touch_updated_at
before update on public.membership_transition_queue
for each row execute function public.touch_updated_at();

alter table public.membership_transition_queue enable row level security;

create policy "temporary deny membership_transition_queue"
on public.membership_transition_queue
for all
using (false)
with check (false);

create or replace function public.prepare_membership_transition_queue(
  legacy_emp_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
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

  delete from public.membership_transition_queue
   where tenant_id = tenant_match.id;

  insert into public.membership_transition_queue (
    tenant_id,
    legacy_user_id,
    email,
    full_name,
    target_role_key,
    queue_status,
    source_blueprint_status,
    metadata
  )
  select
    imb.tenant_id,
    imb.legacy_user_id,
    imb.email,
    imb.full_name,
    imb.target_role_key,
    case when imb.blueprint_status = 'prepared' then 'pending_profile' else 'blocked' end as queue_status,
    imb.blueprint_status,
    jsonb_build_object(
      'blueprint', imb.metadata,
      'nextStep', case when imb.blueprint_status = 'prepared' then 'create_profile_and_membership' else 'resolve_blockers' end
    )
  from public.identity_membership_blueprints imb
  where imb.tenant_id = tenant_match.id;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', mtq.legacy_user_id,
        'email', mtq.email,
        'name', mtq.full_name,
        'role', mtq.target_role_key,
        'status', mtq.queue_status,
        'sourceBlueprintStatus', mtq.source_blueprint_status,
        'metadata', mtq.metadata
      )
      order by mtq.queue_status desc, mtq.full_name
    )
    from public.membership_transition_queue mtq
    where mtq.tenant_id = tenant_match.id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.prepare_membership_transition_queue(text) to anon, authenticated, service_role;

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
  blueprints_data jsonb;
  queue_data jsonb;
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
    jsonb_agg(jsonb_build_object(
      'id', lus.legacy_user_id,
      'name', lus.full_name,
      'email', lus.email,
      'role', lus.role_key,
      'active', lus.active,
      'isCrew', lus.is_crew,
      'crewRole', lus.crew_role
    ) order by lus.full_name),
    '[]'::jsonb
  ) into users_data
  from public.legacy_user_shadows lus
  where lus.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', ic.legacy_user_id,
      'email', ic.email,
      'name', ic.full_name,
      'role', ic.target_role_key,
      'status', ic.status,
      'isCrew', ic.is_crew,
      'crewRole', ic.crew_role
    ) order by ic.full_name),
    '[]'::jsonb
  ) into identities_data
  from public.identity_candidates ic
  where ic.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', ipp.legacy_user_id,
      'email', ipp.email,
      'name', ipp.full_name,
      'role', ipp.target_role_key,
      'status', ipp.plan_status,
      'readinessScore', ipp.readiness_score,
      'missingRequirements', ipp.missing_requirements,
      'sourceSnapshot', ipp.source_snapshot
    ) order by ipp.plan_status desc, ipp.readiness_score desc, ipp.full_name),
    '[]'::jsonb
  ) into plans_data
  from public.identity_promotion_plans ipp
  where ipp.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', imb.legacy_user_id,
      'email', imb.email,
      'name', imb.full_name,
      'role', imb.target_role_key,
      'status', imb.blueprint_status,
      'sourcePlanStatus', imb.source_plan_status,
      'metadata', imb.metadata
    ) order by imb.blueprint_status desc, imb.full_name),
    '[]'::jsonb
  ) into blueprints_data
  from public.identity_membership_blueprints imb
  where imb.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', mtq.legacy_user_id,
      'email', mtq.email,
      'name', mtq.full_name,
      'role', mtq.target_role_key,
      'status', mtq.queue_status,
      'sourceBlueprintStatus', mtq.source_blueprint_status,
      'metadata', mtq.metadata
    ) order by mtq.queue_status desc, mtq.full_name),
    '[]'::jsonb
  ) into queue_data
  from public.membership_transition_queue mtq
  where mtq.tenant_id = tenant_match.id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', al.id,
      'action', al.action,
      'entityType', al.entity_type,
      'entityId', al.entity_id,
      'payload', al.payload,
      'createdAt', al.created_at
    ) order by al.created_at desc),
    '[]'::jsonb
  ) into audit_data
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
    'membershipBlueprints', coalesce(blueprints_data, '[]'::jsonb),
    'membershipTransitionQueue', coalesce(queue_data, '[]'::jsonb),
    'auditLogs', coalesce(audit_data, '[]'::jsonb)
  );
end;
$$;
