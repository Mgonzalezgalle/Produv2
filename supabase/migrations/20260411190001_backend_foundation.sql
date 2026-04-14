create extension if not exists "pgcrypto";

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_code text not null unique,
  legal_name text not null,
  brand_name text not null,
  rut text not null default '',
  billing_email text not null default '',
  phone text not null default '',
  address text not null default '',
  logo_url text not null default '',
  primary_color text not null default '#00d4e8',
  status text not null default 'draft',
  customer_type text not null default 'productora',
  team_size text not null default '1-3',
  billing_currency text not null default 'UF',
  billing_monthly numeric(12,2) not null default 0,
  billing_status text not null default 'Pendiente',
  pending_activation boolean not null default true,
  active boolean not null default false,
  request_type text not null default 'self_serve',
  requested_modules jsonb not null default '[]'::jsonb,
  addons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  global_role text not null default 'viewer',
  status text not null default 'active',
  last_sign_in_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_key text not null,
  label text not null,
  color text not null default '#7c7c8a',
  badge text not null default 'gray',
  is_system boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, role_key)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (role_id, permission_key)
);

create table if not exists public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid null references public.roles(id) on delete set null,
  is_primary_admin boolean not null default false,
  status text not null default 'active',
  joined_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, user_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants(id) on delete cascade,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants(id) on delete cascade,
  provider text not null,
  environment text not null default 'sandbox',
  status text not null default 'draft',
  secret_ref text not null default '',
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, provider, environment)
);

create index if not exists idx_tenants_status on public.tenants(status);
create index if not exists idx_profiles_global_role on public.profiles(global_role);
create index if not exists idx_roles_tenant_id on public.roles(tenant_id);
create index if not exists idx_tenant_users_tenant_id on public.tenant_users(tenant_id);
create index if not exists idx_tenant_users_user_id on public.tenant_users(user_id);
create index if not exists idx_audit_logs_tenant_id on public.audit_logs(tenant_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_integration_credentials_provider on public.integration_credentials(provider);

drop trigger if exists tenants_touch_updated_at on public.tenants;
create trigger tenants_touch_updated_at
before update on public.tenants
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists roles_touch_updated_at on public.roles;
create trigger roles_touch_updated_at
before update on public.roles
for each row execute function public.touch_updated_at();

drop trigger if exists tenant_users_touch_updated_at on public.tenant_users;
create trigger tenant_users_touch_updated_at
before update on public.tenant_users
for each row execute function public.touch_updated_at();

drop trigger if exists integration_credentials_touch_updated_at on public.integration_credentials;
create trigger integration_credentials_touch_updated_at
before update on public.integration_credentials
for each row execute function public.touch_updated_at();

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.tenant_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.integration_credentials enable row level security;

create policy "temporary deny tenants"
on public.tenants
for all
using (false)
with check (false);

create policy "temporary deny profiles"
on public.profiles
for all
using (false)
with check (false);

create policy "temporary deny roles"
on public.roles
for all
using (false)
with check (false);

create policy "temporary deny role_permissions"
on public.role_permissions
for all
using (false)
with check (false);

create policy "temporary deny tenant_users"
on public.tenant_users
for all
using (false)
with check (false);

create policy "temporary deny audit_logs"
on public.audit_logs
for all
using (false)
with check (false);

create policy "temporary deny integration_credentials"
on public.integration_credentials
for all
using (false)
with check (false);
