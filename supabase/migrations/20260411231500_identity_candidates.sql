create table if not exists public.identity_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legacy_user_id text not null,
  email text not null default '',
  full_name text not null default '',
  target_role_key text not null default 'viewer',
  status text not null default 'pending',
  is_crew boolean not null default false,
  crew_role text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, legacy_user_id)
);

create index if not exists idx_identity_candidates_tenant_id on public.identity_candidates(tenant_id);
create index if not exists idx_identity_candidates_email on public.identity_candidates(email);

drop trigger if exists identity_candidates_touch_updated_at on public.identity_candidates;
create trigger identity_candidates_touch_updated_at
before update on public.identity_candidates
for each row execute function public.touch_updated_at();

alter table public.identity_candidates enable row level security;

create policy "temporary deny identity_candidates"
on public.identity_candidates
for all
using (false)
with check (false);

create or replace function public.replace_legacy_identity_candidates(
  legacy_emp_id text,
  candidates jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  item jsonb;
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

  delete from public.identity_candidates
   where tenant_id = tenant_match.id;

  if jsonb_typeof(candidates) = 'array' then
    for item in
      select value from jsonb_array_elements(candidates)
    loop
      insert into public.identity_candidates (
        tenant_id,
        legacy_user_id,
        email,
        full_name,
        target_role_key,
        status,
        is_crew,
        crew_role,
        metadata
      ) values (
        tenant_match.id,
        coalesce(item->>'id', md5(random()::text)),
        lower(coalesce(item->>'email', '')),
        coalesce(item->>'name', ''),
        coalesce(item->>'role', 'viewer'),
        coalesce(item->>'status', 'pending'),
        coalesce((item->>'isCrew')::boolean, false),
        coalesce(item->>'crewRole', ''),
        jsonb_build_object(
          'legacyEmpId', legacy_emp_id,
          'active', coalesce((item->>'active')::boolean, true)
        )
      );
    end loop;
  end if;

  return coalesce((
    select jsonb_agg(
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
    )
    from public.identity_candidates ic
    where ic.tenant_id = tenant_match.id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.replace_legacy_identity_candidates(text, jsonb) to anon, authenticated, service_role;
