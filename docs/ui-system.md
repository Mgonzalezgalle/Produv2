# Produ UI System

Esta guía existe para que `Produ` siga creciendo con una interfaz consistente, seria y operativa.

No busca imponer rigidez de agencia. Busca proteger tres cosas:

- claridad operativa
- consistencia visual
- sensación de plataforma madura

## Principios

### 1. Primero operación, después adorno
Cada pantalla debe ayudar a entender:

- qué está pasando
- qué requiere atención
- qué acción sigue

Si un elemento se ve bien pero no mejora lectura o decisión, no vale la pena.

### 2. Densidad sí, saturación no
`Produ` necesita mostrar bastante información.
La meta no es “hacerla minimalista”.
La meta es que la densidad se sienta:

- ordenada
- jerarquizada
- respirable

### 3. Una sola familia visual
El producto puede tener módulos distintos, pero no debe sentirse como varias apps pegadas.

Buscamos consistencia en:

- métricas
- tablas
- cards
- encabezados
- badges
- formularios
- mensajes de validación y error

### 4. Gobierno y operación deben verse serios
`Admin`, `Tesorería`, `Facturación` y `CRM` no son zonas “auxiliares”.
Son superficies críticas del SaaS y deben transmitir:

- control
- confianza
- estabilidad

## Componentes base

Los componentes compartidos viven en:

- [components.jsx](/Users/matiasgonzalez/produ/src/lib/ui/components.jsx)

Cuando exista un componente base para resolver algo, usarlo antes de crear una variante local.

### ModuleHeader
Usarlo para abrir módulos y superficies principales.

Debe resolver:

- nombre del módulo
- título claro
- descripción breve de propósito
- acciones secundarias, si realmente agregan valor

No usarlo para repetir métricas o badges que ya viven debajo.

### Card
Es el contenedor estándar para bloques de trabajo, detalle o inspección.

Usarlo cuando necesitemos:

- agrupar una función
- separar una sección
- dar contexto a tablas o formularios

Buenas prácticas:

- título corto
- subtítulo orientado a lectura
- no meter demasiadas jerarquías dentro de una sola `Card`

### Stat
Usarlo para métricas simples de lectura ejecutiva.

Sirve para:

- KPIs
- conteos
- montos
- indicadores rápidos

Evitar usar `Stat` para:

- texto largo
- explicación conceptual
- controles

### Badge
Usarlo para estado, categoría o señal rápida.

Regla:

- el badge debe resumir
- no explicar

Buenas prácticas:

- estados operativos
- tipo de registro
- alertas rápidas
- gobierno o disponibilidad

Evitar:

- meter frases largas
- usar demasiados badges juntos si el texto normal resuelve mejor

### Tabs
Usarlas para cambiar de contexto real, no solo por estética.

Deben separar vistas que cambian:

- objetivo
- dataset
- flujo operativo

Si solo cambia un filtro menor, no usar tabs.

### TH y TD
Son la base visual compartida de tablas.

Usarlas para mantener:

- altura consistente
- mejor respiración
- mejor lectura de columnas

No mezclar estilos inline distintos en cada tabla salvo necesidad real.

## Patrones por tipo de superficie

### 1. Entradas de módulo
Los módulos principales deben abrir con:

- `ModuleHeader`
- una superficie hero o intro cuando el módulo lo amerite
- métricas o badges que den contexto real

Esto aplica especialmente a:

- `Admin`
- `Tesorería`
- `Facturación`
- `Dashboard`

### 2. Superficies de gobierno
Para `Admin`, `Plataforma`, `Roles`, `Usuarios`:

- agrupar por bloques editoriales
- usar métricas resumidas arriba
- dejar el detalle operativo después

Orden recomendado:

1. resumen / salud
2. capacidad / cobertura
3. acciones
4. trazabilidad

### 3. Superficies transaccionales
Para `Tesorería` y `Facturación`:

- primero lectura financiera
- luego foco del flujo
- luego tablas y acciones

No empezar con tablas “en frío” si antes podemos instalar contexto.

### 4. Historiales y comentarios
Los historiales deben sentirse compactos, legibles y expandibles.

Base actual:

- [ActivityTimelineCard.jsx](/Users/matiasgonzalez/produ/src/components/shared/ActivityTimelineCard.jsx)
- [ActivityTimelinePreviewModal.jsx](/Users/matiasgonzalez/produ/src/components/shared/ActivityTimelinePreviewModal.jsx)

Regla:

- comprimido por defecto
- legible al expandir
- detalle sin ruido

## Formularios

Los formularios deben hablar claro.

Base actual:

- [components.jsx](/Users/matiasgonzalez/produ/src/lib/ui/components.jsx)

Elementos existentes:

- `VALIDATION_FIELD_STYLE`
- `ValidationHint`
- `ValidationBanner`

Reglas:

- si falta algo, decirlo
- no dejar botones “muertos”
- marcar el campo afectado
- mantener un tono operativo y humano

Ejemplos de buen tono:

- `Falta seleccionar un cliente`
- `Debes ingresar un monto mayor a cero`
- `No has completado el nombre de la oportunidad`

Evitar:

- mensajes técnicos sin contexto
- errores silenciosos
- validaciones ambiguas

## Errores remotos

Base actual:

- [userFacingErrors.js](/Users/matiasgonzalez/produ/src/lib/ui/userFacingErrors.js)

Regla:

- no mostrar errores crudos del backend si podemos traducirlos
- el usuario debe entender qué pasó y qué puede hacer

Preferimos:

- claridad
- consistencia
- tono operativo

## Espaciado y jerarquía

### Ritmo recomendado

- bloques grandes: `margin-bottom` visible
- cards: padding generoso
- tablas: filas aireadas
- headers: descripción corta, nunca muro de texto

### Tipografía

- títulos: `var(--fh)` cuando sea encabezado real
- cifras o montos: `var(--fm)` para mayor estabilidad visual
- texto secundario: `var(--gr2)`
- valor principal: `var(--wh)` o acento cuando corresponda

### Color

El color debe comunicar jerarquía, no decorar.

Uso esperado:

- `var(--cy)`: foco principal
- `#00e08a`: estado sano / logrado
- `#ffcc44`: atención / pendiente
- `var(--red)` o rojo: riesgo / atraso / error
- `purple`: capa de gobierno o contexto especial

## Qué evitar

- crear una variante visual local si ya existe una compartida
- meter demasiados estilos inline distintos para resolver lo mismo
- usar badges para reemplazar texto explicativo
- abrir módulos con tablas sin contexto cuando el módulo es complejo
- usar colores llamativos sin rol semántico
- mezclar mucha microacción dentro de una sola fila si se vuelve ilegible

## Checklist antes de cerrar una pantalla

1. ¿Se entiende qué módulo o sección estoy viendo en menos de 5 segundos?
2. ¿La primera lectura me dice estado, foco o prioridad?
3. ¿Las métricas realmente ayudan a decidir algo?
4. ¿Las tablas se leen con comodidad?
5. ¿Los formularios explican bien qué falta?
6. ¿Los errores hablan el mismo idioma que el resto del producto?
7. ¿La pantalla se siente parte de `Produ` y no una excepción?

## Prioridad al seguir refinando

Cuando haya que seguir puliendo, el orden recomendado es:

1. consistencia de componentes compartidos
2. headers y superficies de entrada
3. métricas y lectura ejecutiva
4. formularios y errores
5. detalle fino por módulo

## Archivos base que hoy sostienen el sistema

- [components.jsx](/Users/matiasgonzalez/produ/src/lib/ui/components.jsx)
- [userFacingErrors.js](/Users/matiasgonzalez/produ/src/lib/ui/userFacingErrors.js)
- [AdminViews.jsx](/Users/matiasgonzalez/produ/src/components/admin/AdminViews.jsx)
- [AdminPanelSections.jsx](/Users/matiasgonzalez/produ/src/components/admin/AdminPanelSections.jsx)
- [AdminRolesEditor.jsx](/Users/matiasgonzalez/produ/src/components/admin/AdminRolesEditor.jsx)
- [InvoiceViews.jsx](/Users/matiasgonzalez/produ/src/components/commercial/InvoiceViews.jsx)
- [TreasuryModule.jsx](/Users/matiasgonzalez/produ/src/components/treasury/TreasuryModule.jsx)
- [ActivityTimelineCard.jsx](/Users/matiasgonzalez/produ/src/components/shared/ActivityTimelineCard.jsx)

## Criterio final

Si una decisión visual deja la pantalla:

- más clara
- más confiable
- más consistente
- más útil para operar

vamos bien.

Si solo la deja “más distinta”, probablemente no.
