create table if not exists public.legacy_storage_audit_logs (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null,
  action text not null,
  actor_role text not null default '',
  actor_user_id uuid null,
  previous_summary jsonb not null default '{}'::jsonb,
  next_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_legacy_storage_audit_logs_storage_key
  on public.legacy_storage_audit_logs(storage_key);

create index if not exists idx_legacy_storage_audit_logs_created_at
  on public.legacy_storage_audit_logs(created_at desc);

create or replace function public.assert_legacy_storage_key(input_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_key text;
begin
  normalized_key := coalesce(trim(input_key), '');
  if normalized_key = '' then
    raise exception 'legacy_storage_key_required';
  end if;
  if normalized_key not like 'produ:%' and normalized_key not like 'produ-lab:%' then
    raise exception 'legacy_storage_key_not_allowed';
  end if;
  return normalized_key;
end;
$$;

create or replace function public.summarize_legacy_storage_value(raw_value text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  parsed jsonb;
begin
  if raw_value is null then
    return jsonb_build_object('type', 'null', 'size', 0);
  end if;

  begin
    parsed := raw_value::jsonb;
  exception
    when others then
      return jsonb_build_object(
        'type', 'text',
        'size', length(raw_value),
        'preview', left(raw_value, 120)
      );
  end;

  if jsonb_typeof(parsed) = 'array' then
    return jsonb_build_object(
      'type', 'array',
      'size', jsonb_array_length(parsed)
    );
  end if;

  if jsonb_typeof(parsed) = 'object' then
    return jsonb_build_object(
      'type', 'object',
      'size', (select count(*) from jsonb_object_keys(parsed) as object_key)
    );
  end if;

  return jsonb_build_object(
    'type', jsonb_typeof(parsed),
    'size', length(raw_value),
    'preview', left(raw_value, 120)
  );
end;
$$;

create or replace function public.append_legacy_storage_audit_log(
  p_storage_key text,
  p_action text,
  p_previous_value text default null,
  p_next_value text default null
)
returns public.legacy_storage_audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  next_log public.legacy_storage_audit_logs;
  safe_key text;
  jwt_role text;
begin
  safe_key := public.assert_legacy_storage_key(p_storage_key);
  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  insert into public.legacy_storage_audit_logs (
    storage_key,
    action,
    actor_role,
    actor_user_id,
    previous_summary,
    next_summary
  )
  values (
    safe_key,
    coalesce(nullif(trim(p_action), ''), 'write'),
    jwt_role,
    auth.uid(),
    public.summarize_legacy_storage_value(p_previous_value),
    public.summarize_legacy_storage_value(p_next_value)
  )
  returning * into next_log;

  return next_log;
end;
$$;

create or replace function public.get_legacy_storage_item(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_key text;
  current_row public.storage%rowtype;
begin
  safe_key := public.assert_legacy_storage_key(p_key);

  select *
    into current_row
    from public.storage
   where key = safe_key
   limit 1;

  if current_row.key is null then
    return jsonb_build_object(
      'ok', true,
      'exists', false,
      'key', safe_key,
      'value', null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'exists', true,
    'key', safe_key,
    'value', current_row.value
  );
end;
$$;

create or replace function public.upsert_legacy_storage_item(
  p_key text,
  p_value text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_key text;
  previous_value text;
  audit_entry public.legacy_storage_audit_logs;
begin
  safe_key := public.assert_legacy_storage_key(p_key);

  select value
    into previous_value
    from public.storage
   where key = safe_key
   limit 1;

  insert into public.storage (key, value)
  values (safe_key, p_value)
  on conflict (key)
  do update set value = excluded.value;

  select public.append_legacy_storage_audit_log(
    safe_key,
    case when previous_value is null then 'insert' else 'upsert' end,
    previous_value,
    p_value
  )
  into audit_entry;

  return jsonb_build_object(
    'ok', true,
    'key', safe_key,
    'auditLogId', audit_entry.id
  );
end;
$$;

alter table public.storage enable row level security;
alter table public.legacy_storage_audit_logs enable row level security;

drop policy if exists "temporary deny storage" on public.storage;
create policy "temporary deny storage"
on public.storage
for all
using (false)
with check (false);

drop policy if exists "temporary deny legacy_storage_audit_logs" on public.legacy_storage_audit_logs;
create policy "temporary deny legacy_storage_audit_logs"
on public.legacy_storage_audit_logs
for all
using (false)
with check (false);

grant execute on function public.assert_legacy_storage_key(text) to anon, authenticated, service_role;
grant execute on function public.summarize_legacy_storage_value(text) to anon, authenticated, service_role;
grant execute on function public.append_legacy_storage_audit_log(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.get_legacy_storage_item(text) to anon, authenticated, service_role;
grant execute on function public.upsert_legacy_storage_item(text, text) to anon, authenticated, service_role;
