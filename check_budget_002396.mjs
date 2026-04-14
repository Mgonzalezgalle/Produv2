import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://zpgxbmlzoxxgymsschrd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ3hibWx6b3h4Z3ltc3NjaHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTkxODksImV4cCI6MjA5MDM5NTE4OX0.HWIkm-Vm255FFrj07pf3JIYE5MNuZ8tukiLYUDCuZK8');
const { data: keys, error } = await sb.from('storage').select('key').like('key', 'produ:%:presupuestos');
if (error) throw error;
for (const row of keys || []) {
  const { data, error: rowError } = await sb.from('storage').select('value').eq('key', row.key).maybeSingle();
  if (rowError || !data) continue;
  const arr = JSON.parse(data.value || '[]');
  console.log(row.key, Array.isArray(arr) ? arr.length : 0);
  const hit = Array.isArray(arr) ? arr.find(x => String(x?.correlativo || x?.numero || x?.nro || '') === '002396') : null;
  if (hit) {
    console.log('FOUND_IN', row.key);
    console.log(JSON.stringify(hit, null, 2));
  }
}
