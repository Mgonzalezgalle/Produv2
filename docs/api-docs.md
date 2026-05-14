# API Docs de Produ

## Resumen

`Produ` hoy expone su capa remota en dos carriles principales:

1. `Supabase Edge Functions`
2. `Supabase RPC / foundation`

No existe todavía un `REST API` único, versionado y completamente público para todo el producto. La arquitectura actual está compuesta por:

- funciones remotas para integraciones y automatizaciones
- RPCs para sincronización, auditoría y registros foundation
- una capa de adaptador en frontend que invoca ambos carriles

Este documento describe la superficie real que existe hoy en el código.

---

## Arquitectura actual

### Edge Functions

Se usan para:

- integraciones con terceros
- webhooks
- envío de correos
- OAuth con Google Calendar
- links de pago y conciliación con Mercado Pago
- importación y recepción de eventos desde Diio

Base URL:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/<function-name>
```

En la app, normalmente se invocan con:

```js
sb.functions.invoke("<function-name>", { body: payload })
```

---

### RPC / Foundation

Se usa para:

- snapshots de tenant
- auditoría
- sincronización financiera
- registros por entidad
- estado de sincronización Bsale
- almacenamiento legado gobernado

En la app, normalmente se invoca con:

```js
sb.rpc("<rpc_name>", params)
```

---

## Autenticación y seguridad

### Edge Functions invocadas por la app

Cuando la app no usa `sb.functions.invoke(...)`, el fallback directo usa:

- header `apikey: <SUPABASE_ANON_KEY>`
- header `Authorization: Bearer <SUPABASE_ANON_KEY>`
- `Content-Type: application/json`

Esto aplica a funciones invocadas desde el cliente y no significa que todas deban abrirse a terceros sin control adicional.

### Webhooks

Algunas funciones validan firma o secreto propio:

- `mercadopago-handle-webhook`
- `diio-handle-webhook`

### Credenciales sensibles

Nunca deben enviarse desde un cliente externo:

- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `DIIO` secrets

---

## Catálogo de Edge Functions

## 1. `send-transactional-email`

**Método**

- `POST`

**Propósito**

- envío de correos transaccionales por `Resend`

**Uso típico**

- alertas
- notificaciones operativas
- mensajes asociados a presupuestos, portal cliente o flujos internos

**Payload**

```json
{
  "tenantId": "emp_xxx",
  "templateKey": "generic_notification",
  "subject": "Nuevo feedback de cliente",
  "previewText": "Resumen breve",
  "to": [{ "email": "equipo@empresa.cl", "name": "Equipo" }],
  "cc": [],
  "bcc": [],
  "html": "<p>...</p>",
  "text": "texto plano",
  "attachments": [
    {
      "name": "adjunto.pdf",
      "src": "data:application/pdf;base64,..."
    }
  ],
  "replyTo": "hola@empresa.cl",
  "tags": ["portal", "cliente"],
  "entityType": "content_piece",
  "entityId": "piece_xxx",
  "metadata": {
    "companyName": "Play Media SpA"
  }
}
```

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "resend",
  "delivery": {
    "id": "re_xxx",
    "tenantId": "emp_xxx",
    "templateKey": "generic_notification",
    "subject": "Notificación de Play Media SpA",
    "to": [{ "email": "equipo@empresa.cl", "name": "Equipo" }],
    "entityType": "content_piece",
    "entityId": "piece_xxx",
    "metadata": {},
    "createdAt": "2026-05-14T00:00:00.000Z"
  }
}
```

---

## 2. `mercadopago-create-payment-link`

**Método**

- `POST`

**Propósito**

- crear links de pago para facturas o cobranza

**Payload**

```json
{
  "tenantId": "emp_xxx",
  "invoiceId": "inv_xxx",
  "externalReference": "FAC-2026-0012",
  "amount": 1497000,
  "currency": "CLP",
  "description": "Pago de factura FAC-2026-0012",
  "customer": {
    "id": "cli_xxx",
    "name": "Go Soluciones",
    "email": "pagos@gosoluciones.cl"
  },
  "metadata": {
    "clientName": "Go Soluciones"
  },
  "payload": {},
  "tenantConfig": {
    "accessToken": "APP_USR-...",
    "sellerAccountLabel": "Cuenta principal",
    "marketplace": "MLC"
  }
}
```

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "mercadopago",
  "paymentLink": {
    "provider": "mercadopago",
    "mode": "api",
    "status": "active",
    "preferenceId": "123456789",
    "externalReference": "FAC-2026-0012",
    "initPoint": "https://www.mercadopago.cl/checkout/...",
    "sandboxInitPoint": "",
    "createdAt": "2026-05-14T00:00:00.000Z",
    "expiresAt": "",
    "amount": 1497000,
    "currency": "CLP",
    "customerName": "Go Soluciones",
    "sellerAccountLabel": "Cuenta principal"
  },
  "preference": {}
}
```

---

## 3. `mercadopago-handle-webhook`

**Método**

- `POST`

**Propósito**

- normalizar el estado de un pago desde Mercado Pago

**Observación**

- puede trabajar con `paymentId` directo
- o resolver por `externalReference` / `preferenceId`

**Payload base**

```json
{
  "tenantId": "emp_xxx",
  "invoiceId": "inv_xxx",
  "paymentId": "123456789",
  "preferenceId": "987654321",
  "externalReference": "FAC-2026-0012",
  "amount": 1497000,
  "currency": "CLP",
  "status": "approved",
  "metadata": {},
  "tenantConfig": {
    "accessToken": "APP_USR-...",
    "webhookSecret": "secret_xxx"
  }
}
```

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "mercadopago",
  "paymentResult": {
    "status": "approved",
    "approved": true,
    "paymentId": "123456789",
    "amount": 1497000,
    "currency": "CLP",
    "preferenceId": "987654321",
    "externalReference": "FAC-2026-0012",
    "paidAt": "2026-05-14T00:00:00.000Z",
    "metadata": {}
  }
}
```

---

## 4. `google-calendar-oauth-start`

**Método**

- `POST`

**Propósito**

- iniciar OAuth de Google Calendar

**Payload**

```json
{
  "tenantId": "emp_xxx",
  "userId": "usr_xxx",
  "userEmail": "usuario@empresa.cl",
  "redirectTo": "https://app.produ.cl/admin/empresa",
  "scopes": [
    "https://www.googleapis.com/auth/calendar.events"
  ],
  "prompt": "consent"
}
```

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "google",
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "{\"tenantId\":\"emp_xxx\"}",
  "redirectUri": "https://<project>.supabase.co/functions/v1/google-calendar-oauth-callback",
  "scopes": [
    "https://www.googleapis.com/auth/calendar.events"
  ]
}
```

---

## 5. `google-calendar-oauth-callback`

**Métodos**

- `GET`
- `POST`

**Propósito**

- completar OAuth y devolver la conexión ya resuelta

**Payload POST**

```json
{
  "code": "4/0AQSTg...",
  "state": "{\"tenantId\":\"emp_xxx\",\"userId\":\"usr_xxx\"}"
}
```

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "google",
  "connection": {
    "tenantId": "emp_xxx",
    "userId": "usr_xxx",
    "userEmail": "usuario@empresa.cl",
    "redirectTo": "https://app.produ.cl/admin/empresa",
    "refreshToken": "1//0g....",
    "expiresIn": 3599,
    "scope": "https://www.googleapis.com/auth/calendar.events",
    "tokenType": "Bearer",
    "calendarId": "primary",
    "calendarName": "Calendario principal",
    "connectedAt": "2026-05-14T00:00:00.000Z"
  }
}
```

---

## 6. `google-calendar-create-event`

**Método**

- `POST`

**Propósito**

- crear o actualizar eventos en Google Calendar

**Payload**

```json
{
  "calendarId": "primary",
  "refreshToken": "1//0g....",
  "googleEventId": "",
  "summary": "Reunión con cliente",
  "description": "Revisión editorial",
  "startDateTime": "2026-05-14T11:00:00-04:00",
  "endDateTime": "2026-05-14T11:30:00-04:00",
  "timeZone": "America/Santiago",
  "attendees": ["hola@cliente.cl"],
  "addMeet": true
}
```

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "google",
  "event": {}
}
```

---

## 7. `google-calendar-list-events`

**Método**

- `POST`

**Propósito**

- listar eventos de un calendario

**Payload**

```json
{
  "calendarId": "primary",
  "refreshToken": "1//0g....",
  "timeMin": "2026-05-01T00:00:00-04:00",
  "timeMax": "2026-05-31T23:59:59-04:00"
}
```

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "google",
  "items": []
}
```

---

## 8. `google-calendar-delete-event`

**Método**

- `POST`

**Propósito**

- eliminar un evento de Google Calendar

**Payload**

```json
{
  "calendarId": "primary",
  "refreshToken": "1//0g....",
  "googleEventId": "3nce1k..."
}
```

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "google"
}
```

---

## 9. `diio-company-api`

**Método**

- `POST`

**Propósito**

- validar conexión con Diio
- refrescar token
- importar reuniones y llamadas
- enriquecer payloads con transcript, playbook y usuarios

**Acciones observadas en código**

- `health_check`
- `refresh_token`
- `import_meetings`

**Payload base**

```json
{
  "tenantId": "emp_xxx",
  "action": "import_meetings"
}
```

**Respuesta OK de validación**

```json
{
  "ok": true,
  "tenantId": "emp_xxx",
  "companyUrl": "https://empresa.diio.com",
  "accessTokenPreview": "eyJhbGciOiJ..."
}
```

**Notas**

- usa configuración Diio guardada por tenant
- al importar, persiste interacciones en storage del tenant
- marca el tenant como `connected` cuando valida correctamente

---

## 10. `diio-handle-webhook`

**Métodos**

- `GET`
- `POST`

**Propósito**

- recibir webhooks de Diio
- validar firma
- enriquecer el payload
- persistir la interacción en la cola de incoming del tenant

**Casos especiales**

- `GET ?echo_string=...` responde el valor recibido para handshake

**Payload esperado**

El webhook acepta el JSON de Diio y además puede resolver tenant por:

- `tenantId`
- `tenantCode`
- `workspace_id`
- `webhook_id`

**Respuesta OK**

```json
{
  "ok": true,
  "source": "remote",
  "provider": "diio",
  "tenantId": "emp_xxx",
  "tenantName": "Play Media SpA",
  "interaction": {}
}
```

---

## RPCs / Foundation

Las siguientes operaciones existen hoy en código y forman parte del carril foundation. No deben tratarse todavía como API pública estable para terceros.

## Tenants y gobierno

- `request_tenant_bootstrap`
- `sync_legacy_tenant_snapshot`
- `replace_legacy_tenant_user_shadows`
- `replace_legacy_identity_candidates`
- `plan_legacy_identity_promotions`
- `prepare_identity_membership_blueprints`
- `prepare_membership_transition_queue`

## Auditoría y eventos

- `append_legacy_sync_audit_log`
- `append_legacy_operational_event`
- `get_legacy_operational_events`

## Registros financieros

- `upsert_legacy_financial_registry_snapshot`
- `get_legacy_financial_registry_snapshot`
- `upsert_legacy_financial_registry_record`
- `delete_legacy_financial_registry_record`

## Bsale

- `get_bsale_sync_status`
- `upsert_bsale_sync_session`
- `get_bsale_sync_sessions`

## Storage legado gobernado

- `get_legacy_storage_item`
- `upsert_legacy_storage_item`

---

## Adaptador de API en frontend

La app ya tiene un adaptador que agrupa estas capacidades en:

- `auth`
- `tenants`
- `checkout`
- `billing`
- `foundation`
- `notifications`
- `payments`
- `calendar`

Referencia:

- `/src/lib/backend/supabasePlatformApiAdapter.js`

Esto es importante porque permite construir una documentación futura más uniforme aunque hoy la superficie remota aún esté repartida entre RPCs y Edge Functions.

---

## Ejemplos rápidos

## Crear link de pago

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/mercadopago-create-payment-link" \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -d '{
    "tenantId": "emp_xxx",
    "invoiceId": "inv_xxx",
    "externalReference": "FAC-2026-0012",
    "amount": 1497000,
    "currency": "CLP",
    "description": "Pago factura FAC-2026-0012",
    "customer": { "name": "Go Soluciones", "email": "pagos@gosoluciones.cl" },
    "tenantConfig": { "accessToken": "APP_USR-...", "marketplace": "MLC" }
  }'
```

## Iniciar OAuth de Google Calendar

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/google-calendar-oauth-start" \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -d '{
    "tenantId": "emp_xxx",
    "userId": "usr_xxx",
    "userEmail": "usuario@empresa.cl",
    "redirectTo": "https://app.produ.cl/admin/empresa"
  }'
```

## Enviar correo transaccional

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/send-transactional-email" \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -d '{
    "tenantId": "emp_xxx",
    "subject": "Nuevo feedback de cliente",
    "to": [{ "email": "equipo@empresa.cl", "name": "Equipo" }],
    "html": "<p>Tienes una nueva respuesta.</p>",
    "entityType": "content_piece",
    "entityId": "piece_xxx"
  }'
```

---

## Estado actual y recomendación CTO

Hoy `Produ` sí tiene una superficie remota útil y operativa, pero todavía no conviene presentarla como una API pública unificada de plataforma.

La recomendación correcta es pensarla en 3 capas:

1. `Edge Functions públicas controladas`
2. `RPCs foundation internos`
3. `Adaptador de producto`

El siguiente paso maduro sería crear una `API pública v1` con:

- versionado
- autenticación homogénea
- naming consistente
- separación clara entre integraciones y operaciones internas
- OpenAPI formal

Hasta entonces, este documento debe leerse como la referencia viva de la superficie remota real de `Produ`.
