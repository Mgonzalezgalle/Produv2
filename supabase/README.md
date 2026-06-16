# Supabase Foundation

Esta carpeta concentra la base server-side de Produ para `lab`.

## Objetivo

Pasar de un uso mínimo de Supabase como storage genérico a una fundación SaaS real para:

- auth
- tenants
- users
- roles
- permissions
- audit logs
- integraciones

## Estructura

- `config.toml`
  configuración local del proyecto Supabase CLI
- `migrations/`
  migraciones SQL versionadas
- `seed.sql`
  datos mínimos de referencia para `lab`

## Primera fase

La primera fase crea el dominio base para:

- `tenants`
- `profiles`
- `tenant_users`
- `roles`
- `role_permissions`
- `audit_logs`
- `integration_credentials`

## Importante

- `lab` será el primer entorno que use esta base
- `productivo` no se toca todavía
- RLS se deja preparada como siguiente fase, no se fuerza completa en esta primera migración

## Edge Functions con secretos

- `simpleapi-rcv`
  consulta el Registro de Compras y Ventas del SII via SimpleAPI
  requiere el secreto `SIMPLEAPI_RCV_API_KEY`
  el certificado `.pfx`, `RutCertificado`, `RutEmpresa` y password viajan en el payload al backend; no deben quedar en frontend persistente sin cifrado
