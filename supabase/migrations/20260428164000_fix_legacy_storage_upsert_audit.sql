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
