# Portal cliente V1

## Objetivo

Abrir un espacio externo para los clientes de cada empresa que usa Produ, con acceso simple y controlado para:

- revisar avance
- aprobar contenidos
- aprobar presupuestos
- ver documentos y pagos pendientes

Este portal no es para usuarios internos del tenant. Es para los clientes de ese tenant.

## Modelo

- `tenant`: empresa que usa Produ
- `client`: cliente comercial de ese tenant
- `client portal`: acceso externo asociado a un cliente específico

Cada cliente puede tener un portal propio con:

- enlace estable
- código de acceso
- correos autorizados
- historial de último acceso y último envío

## Punto de origen

La administración del portal nace desde `Clientes`.

En la ficha del cliente debe existir un bloque `Portal cliente` para:

- activar o desactivar acceso
- copiar enlace
- regenerar código
- administrar correos autorizados

## Acceso V1

La V1 queda pensada con este patrón:

- URL persistente por cliente
- código corto de 6 dígitos
- validación contra correos autorizados del cliente

Ejemplo conceptual:

- `/portal/clientes/{slug-estable}`

## Qué verá el cliente

### Resumen

- producciones activas
- piezas pendientes de aprobación
- presupuestos pendientes
- documentos vencidos
- pagos por realizar

### Contenidos

- piezas por mes
- vista previa
- aprobar
- pedir ajustes
- dejar observaciones
- dejar brief adicional

### Presupuestos

- ver presupuesto
- aprobar
- rechazar
- comentar

### Documentos y pagos

- facturas
- vencimientos
- estado
- monto pendiente
- links de pago

### Producciones

- estado general
- hitos
- avances
- bloqueos visibles para el cliente

## Datos mínimos por cliente

Se propone guardar un objeto `portal` dentro del cliente:

```json
{
  "enabled": true,
  "accessMode": "email_code",
  "slug": "playmedia-9x3m2k1q",
  "accessCode": "516426",
  "authorizedEmails": ["contacto@playmedia.cl"],
  "createdAt": "2026-05-12T15:00:00.000Z",
  "updatedAt": "2026-05-12T15:00:00.000Z",
  "lastSharedAt": null,
  "lastAccessAt": null,
  "notes": ""
}
```

## Seguridad V1

- el acceso pertenece a un cliente puntual
- no debe mezclarse con usuarios internos de Produ
- no debe exponer información de otros clientes del mismo tenant
- el acceso puede desactivarse desde la ficha del cliente

## Implementación incremental

### Fase 1

- bloque `Portal cliente` en la ficha del cliente
- enlace estable
- código de acceso
- correos autorizados

### Fase 2

- ruta pública del portal
- pantalla de ingreso por código
- vista de resumen
- vista de documentos y pagos

### Fase 3

- aprobaciones de contenido
- comentarios y brief adicional
- aprobación de presupuestos

### Fase 4

- auditoría de accesos
- notificaciones
- múltiples contactos por cliente
- expiración o rotación opcional de códigos
