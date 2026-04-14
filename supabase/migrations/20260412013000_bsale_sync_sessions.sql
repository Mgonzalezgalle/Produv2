create table if not exists public.bsale_sync_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_document_id text not null,
  source_document_type text not null default 'factura',
  session_key text not null,
  provider text not null default 'bsale',
  mode text not null default 'manual',
  status text not null default 'draft',
  external_document_id text not null default '',
  external_folio text not null default '',
  provider_status text not null default '',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, session_key)
);

create index if not exists idx_bsale_sync_sessions_tenant_id on public.bsale_sync_sessions(tenant_id);
create index if not exists idx_bsale_sync_sessions_document_id on public.bsale_sync_sessions(source_document_id);

drop trigger if exists bsale_sync_sessions_touch_updated_at on public.bsale_sync_sessions;
create trigger bsale_sync_sessions_touch_updated_at
before update on public.bsale_sync_sessions
for each row execute function public.touch_updated_at();

alter table public.bsale_sync_sessions enable row level security;

create policy "temporary deny bsale_sync_sessions"
on public.bsale_sync_sessions
for all
using (false)
with check (false);

create or replace function public.upsert_bsale_sync_session(
  legacy_emp_id text,
  source_document_id text,
  session_key text,
  status_name text default 'draft',
  external_document_id text default '',
  external_folio text default '',
  provider_status_name text default '',
  request_payload_data jsonb default '{}'::jsonb,
  response_payload_data jsonb default '{}'::jsonb,
  metadata_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_match public.tenants;
  row_data public.bsale_sync_sessions;
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

  insert into public.bsale_sync_sessions (
    tenant_id,
    source_document_id,
    session_key,
    status,
    external_document_id,
    external_folio,
    provider_status,
    request_payload,
    response_payload,
    metadata
  ) values (
    tenant_match.id,
    source_document_id,
    session_key,
    status_name,
    coalesce(external_document_id, ''),
    coalesce(external_folio, ''),
    coalesce(provider_status_name, ''),
    coalesce(request_payload_data, '{}'::jsonb),
    coalesce(response_payload_data, '{}'::jsonb),
    coalesce(metadata_data, '{}'::jsonb)
  )
  on conflict (tenant_id, session_key)
  do update set
    source_document_id = excluded.source_document_id,
    status = excluded.status,
    external_document_id = excluded.external_document_id,
    external_folio = excluded.external_folio,
    provider_status = excluded.provider_status,
    request_payload = excluded.request_payload,
    response_payload = excluded.response_payload,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now())
  returning * into row_data;

  return jsonb_build_object(
    'id', row_data.id,
    'sourceDocumentId', row_data.source_document_id,
    'sessionKey', row_data.session_key,
    'status', row_data.status,
    'externalDocumentId', row_data.external_document_id,
    'externalFolio', row_data.external_folio,
    'providerStatus', row_data.provider_status,
    'metadata', row_data.metadata,
    'createdAt', row_data.created_at,
    'updatedAt', row_data.updated_at
  );
end;
$$;

grant execute on function public.upsert_bsale_sync_session(text, text, text, text, text, text, text, jsonb, jsonb, jsonb) to anon, authenticated, service_role;

create or replace function public.get_bsale_sync_sessions(
  legacy_emp_id text,
  source_document_id text default ''
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

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', bss.id,
        'sourceDocumentId', bss.source_document_id,
        'sessionKey', bss.session_key,
        'status', bss.status,
        'externalDocumentId', bss.external_document_id,
        'externalFolio', bss.external_folio,
        'providerStatus', bss.provider_status,
        'metadata', bss.metadata,
        'createdAt', bss.created_at,
        'updatedAt', bss.updated_at
      )
      order by bss.updated_at desc
    )
    from public.bsale_sync_sessions bss
    where bss.tenant_id = tenant_match.id
      and (coalesce(source_document_id, '') = '' or bss.source_document_id = source_document_id)
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_bsale_sync_sessions(text, text) to anon, authenticated, service_role;
