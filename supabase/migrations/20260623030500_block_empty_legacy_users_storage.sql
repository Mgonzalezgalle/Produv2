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
  normalized_value jsonb;
  audit_entry public.legacy_storage_audit_logs;
begin
  safe_key := public.assert_legacy_storage_key(p_key);

  if safe_key = 'produ:users' then
    begin
      normalized_value := p_value::jsonb;
    exception
      when others then
        raise exception 'invalid_users_payload';
    end;

    if jsonb_typeof(normalized_value) <> 'array' then
      raise exception 'invalid_users_payload';
    end if;

    if jsonb_array_length(normalized_value) = 0 then
      raise exception 'blocked_empty_users_payload';
    end if;
  end if;

  select value
    into previous_value
    from public.storage
   where key = safe_key
   limit 1;

  insert into public.storage (key, value)
  values (safe_key, p_value)
  on conflict (key)
  do update set value = excluded.value;

  audit_entry := public.append_legacy_storage_audit_log(
    safe_key,
    case when previous_value is null then 'insert' else 'upsert' end,
    previous_value,
    p_value
  );

  return jsonb_build_object(
    'ok', true,
    'key', safe_key,
    'auditLogId', audit_entry.id
  );
end;
$$;
