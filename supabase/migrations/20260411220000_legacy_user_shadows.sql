create table if not exists public.legacy_user_shadows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  legacy_user_id text not null,
  full_name text not null default '',
  email text not null default '',
  role_key text not null default 'viewer',
  active boolean not null default true,
  is_crew boolean not null default false,
  crew_role text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, legacy_user_id)
);

create index if not exists idx_legacy_user_shadows_tenant_id on public.legacy_user_shadows(tenant_id);
create index if not exists idx_legacy_user_shadows_email on public.legacy_user_shadows(email);

drop trigger if exists legacy_user_shadows_touch_updated_at on public.legacy_user_shadows;
create trigger legacy_user_shadows_touch_updated_at
before update on public.legacy_user_shadows
for each row execute function public.touch_updated_at();

alter table public.legacy_user_shadows enable row level security;

create policy "temporary deny legacy_user_shadows"
on public.legacy_user_shadows
for all
using (false)
with check (false);

create or replace function public.replace_legacy_tenant_user_shadows(
  legacy_emp_id text,
  user_shadows jsonb default '[]'::jsonb
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

  delete from public.legacy_user_shadows
   where tenant_id = tenant_match.id;

  if jsonb_typeof(user_shadows) = 'array' then
    for item in
      select value from jsonb_array_elements(user_shadows)
    loop
      insert into public.legacy_user_shadows (
        tenant_id,
        legacy_user_id,
        full_name,
        email,
        role_key,
        active,
        is_crew,
        crew_role,
        metadata
      ) values (
        tenant_match.id,
        coalesce(item->>'id', md5(random()::text)),
        coalesce(item->>'name', ''),
        lower(coalesce(item->>'email', '')),
        coalesce(item->>'role', 'viewer'),
        coalesce((item->>'active')::boolean, true),
        coalesce((item->>'isCrew')::boolean, false),
        coalesce(item->>'crewRole', ''),
        jsonb_build_object(
          'legacyEmpId', legacy_emp_id,
          'empId', coalesce(item->>'empId', legacy_emp_id)
        )
      );
    end loop;
  end if;

  return coalesce((
    select jsonb_agg(
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
    )
    from public.legacy_user_shadows lus
    where lus.tenant_id = tenant_match.id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.replace_legacy_tenant_user_shadows(text, jsonb) to anon, authenticated, service_role;
