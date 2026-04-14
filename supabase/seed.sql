insert into public.tenants (
  tenant_code,
  legal_name,
  brand_name,
  rut,
  billing_email,
  phone,
  status,
  customer_type,
  team_size,
  active,
  pending_activation,
  addons,
  requested_modules
) values (
  'T-0001',
  'Play Media SpA',
  'Play Media SpA',
  '77.118.348-2',
  'matias@grupogonzalez.co',
  '+56 9 0000 0000',
  'active',
  'productora',
  '4-10',
  true,
  false,
  '["crm","facturacion","tesoreria","presupuestos","tareas"]'::jsonb,
  '["crm","facturacion","tesoreria","presupuestos","tareas"]'::jsonb
) on conflict do nothing;
