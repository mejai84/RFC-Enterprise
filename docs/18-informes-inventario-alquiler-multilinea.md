# Informes de inventario, catálogo de transporte y alquiler multi-línea

**Fecha:** 2026-10-20
**Alcance:** módulo de Informes/Inventario, catálogo de transporte del APU y módulo de Alquiler rápido.

## 1. Informes de inventario

Los informes se calculan en `src/modules/inventory/domain/report-metrics.ts` con funciones puras y tipadas. La pantalla `reports-workspace.tsx` solo presenta los resultados. Los datos salen de Supabase:

- Existencias y costo: `inventory_stock` + `inventory_items`, cargados en el servidor con `getInventoryProducts()`.
- Movimientos: `inventory_movements`, con proyecto, cantidad, costo y fecha.
- Proyectos: `projects`.
- Cotizaciones: `loadQuotesWorkspaceData()` del módulo de Cotizaciones (ya no se leen filas en crudo).
- Alquileres: `quick_rental_orders` con sus líneas, mediante `listQuickRentalOrders()`.

### Informes nuevos

| Informe | Cálculo | Decisión que apoya |
| --- | --- | --- |
| Consumo por obra | Salidas del periodo agrupadas por `project_id`; suma cantidad y `totalCost`. Las salidas sin obra se muestran como `Sin obra / Bodega`. | Saber qué obra consume el inventario y cuánto cuesta. |
| Rotación | `unidades salidas en el periodo ÷ existencia actual` por referencia. Si la existencia es cero y hubo salidas, el índice se muestra como `—`. | Detectar referencias que se mueven y referencias estancadas. |
| Stock inmovilizado | Referencias con existencia `> 0` y sin salidas en el periodo; valoriza `existencia × costo unitario`. | Liberar capital y revisar compras repetidas. |
| Valoración por grupo | Agrupa por `inventory_group` (Bodega, Dotación, Trabajadores) y suma referencias, unidades y `existencia × costo unitario`. | Ver dónde está concentrado el valor del inventario. |

El selector **Periodo de análisis** permite 30 días, 90 días, 12 meses o histórico completo. Aplica a consumo, rotación e inmovilizado. El filtro de categoría aplica a todos; el de proyecto aplica a consumo, ejecución por obra y kardex, y se deshabilita donde no tiene sentido (rotación, inmovilizado y valoración).

### Limitación declarada

La rotación es un **índice operativo**, no un costo de ventas contable: el sistema todavía no guarda fotografías históricas de existencias. Por eso se usa la existencia actual como denominador y se explica en la propia pantalla. Queda registrado como riesgo `INF-001` en `06-backlog-y-riesgos.md`.

La exportación CSV incluye los cuatro informes nuevos y el detalle multi-línea de alquileres.

## 2. Auditoría de localStorage

| Clave | Uso anterior | Estado desde 2026-10-20 |
| --- | --- | --- |
| `rfc_apu_transport_items` | Catálogo de transporte del APU; se escribía en cada alta/edición y se usaba como respaldo si Supabase fallaba. | **Deja de ser fuente de verdad.** Se lee una sola vez para importar a Supabase los códigos que no existan en la empresa. La clave se elimina únicamente si la importación termina sin errores. Si falla, se conserva para reintentar y la pantalla muestra el aviso. |
| `rfc_quick_rentals` | Resto histórico de una versión anterior del alquiler rápido. | Sin lecturas ni escrituras en el código actual. El flujo activo usa `quick_rental_orders`. |
| `rfc_apus` | Respaldo de lectura de APU en pantallas de consulta. | Fuera del alcance de esta entrega; sigue siendo respaldo de lectura, no fuente de verdad del APU. |
| `rfc_quotes` | Respaldo de lectura en Obras/Proyectos. | Fuera del alcance; no se usa para confirmar alquileres ni transporte. |
| `rfc_inventory_projects` | Respaldo de lectura de proyectos en APU. | Fuera del alcance; no se usa para confirmar alquileres ni transporte. |
| `rfc_nav_groups`, `rfc_dashboard_sidebar_collapsed`, `rfc_apu_rubros_plegados`, `rfc_apu_activity_order` | Preferencias de interfaz. | No son datos de negocio. |

### Migración segura del catálogo de transporte

1. La pantalla consulta `apu_transport_items` de la empresa activa.
2. Si existe la clave legada, se comparan los códigos. Solo se importan los códigos ausentes; nunca se sobrescribe un ítem que ya está en Supabase.
3. La importación usa `upsert ... ignoreDuplicates` sobre `(company_id, code)`.
4. Si la importación falla, la clave local permanece y se informa el error. Si termina bien, se elimina.
5. Después de la migración, la única fuente de verdad es Supabase. Sin sesión o sin configuración, la pantalla muestra un catálogo vacío con aviso; no inventa datos locales.

No se modificaron migraciones, RLS ni autenticación.

## 3. Alquiler rápido multi-línea

El flujo activo es `MultiRentalOrderWorkspace`. La variante de un solo equipo (`quick-rental-workspace.tsx`) se retiró para que no exista un segundo flujo con catálogo local.

### Modelo persistido

- `quick_rental_orders`: cabecera con cliente, documento, periodo, estado, notas y consecutivo.
- `quick_rental_order_items`: una fila por equipo, con cantidad, tarifa diaria, garantía unitaria, cantidad devuelta, notas de devolución y recargo.
- `quick_rental_order_attachments`: firma de entrega en el bucket privado `rental-attachments`.

La tabla histórica `quick_rentals` no se migra ni se modifica: queda como histórico de la etapa anterior. El flujo nuevo no la usa como fuente de verdad.

### Flujo

1. La pantalla carga la bodega desde `inventory_stock` e `inventory_items`. Solo muestra equipos y herramientas.
2. La disponibilidad se calcula como `existencia − cantidades pendientes de documentos activos, parcialmente devueltos o vencidos`.
3. El usuario arma un carrito con varias líneas, cantidades, tarifa diaria y garantía unitaria.
4. Al continuar, se captura **una sola firma** para toda la entrega.
5. Antes de insertar, el repositorio vuelve a consultar la disponibilidad. Si otro usuario ya entregó el equipo, se cancela con un mensaje claro.
6. La factura consolida todas las líneas: `cantidad × días × tarifa + recargo`, más la garantía total.
7. Cada línea admite devolución total o parcial por separado, con cantidad, estado en que se recibe y recargo. El estado del documento pasa a `partially_returned` o `returned` según las líneas.
8. El vencimiento se deriva de `due_at` para la interfaz; no se escribe un estado `overdue` artificial.

### Permisos y límites

- La lectura la puede hacer cualquier miembro de la empresa según RLS. La escritura sigue las políticas existentes de gerente de inventario; no se relajaron.
- La validación de disponibilidad es una relectura en el cliente antes de insertar. Dos entregas simultáneas podrían competir en la misma ventana; cerrarlo del todo requiere una RPC transaccional. Queda registrado como riesgo `ALQ-005`.
- Si la firma no se puede subir después de registrar la entrega, el documento queda creado y la pantalla informa el fallo. No se oculta ni se pierde la entrega.
- La cabecera y las líneas se escriben en dos pasos. Si el segundo falla, la cabecera puede quedar sin líneas; la política actual no permite borrarla. Queda registrado como riesgo `ALQ-006` y la solución correcta es una RPC transaccional, que requiere una migración fuera de este alcance.
- La factura usa los días del periodo pactado (`pickup_at` → `due_at`) para todas las líneas. Una devolución anticipada no prorratea automáticamente la renta; el recargo manual de la devolución cubre demoras, daños o faltantes. Si se requiere prorrateo, debe definirse una regla comercial y una columna de días facturados por línea.

## 4. Verificación

- `npx tsc --noEmit`: sin errores.
- Prueba de humo con Node sobre `report-metrics.ts`: consumo por periodo, rotación, inmovilizado y valoración; incluye stock cero con salidas y salidas sin obra.
- `npm run build`: compilación de producción correcta; `/reports` queda como ruta dinámica para leer el inventario con la sesión y RLS del usuario.
- ESLint focalizado en los archivos nuevos y en los cambios de lógica de Informes/Alquiler: sin errores. El lint global del repositorio sigue arrastrando errores previos en APU y otros módulos (por ejemplo, `setState` dentro de un efecto en `apu-transport-picker.tsx`); no se corrigieron para no ampliar el alcance.

## 5. Archivos de esta entrega

**Creados**

- `src/modules/inventory/domain/report-metrics.ts`
- `src/modules/rentals/domain/quick-rental-order.ts`
- `src/modules/rentals/data/quick-rental-order-repository.ts`
- `docs/18-informes-inventario-alquiler-multilinea.md`

**Modificados**

- `src/modules/inventory/presentation/reports-workspace.tsx`
- `src/modules/rentals/presentation/multi-rental-order-workspace.tsx`
- `src/modules/rentals/presentation/rentals-summary-card.tsx`
- `src/modules/rentals/index.ts`
- `src/modules/apu/data/transport-repository.ts`
- `src/modules/apu/presentation/apu-workspace.tsx`
- `src/modules/apu/presentation/apu-transport-picker.tsx` (solo aviso de catálogo no disponible y no inventar respaldo local)
- `src/app/reports/page.tsx` (cambio inevitable: `force-dynamic` para no prerenderizar el inventario con la sesión vacía de la compilación)
- `docs/02-modulos-y-roadmap.md`
- `docs/06-backlog-y-riesgos.md`
- `docs/07-registro-de-decisiones.md`
- `docs/09-costeo-proyectos-y-materiales.md`
- `docs/14-firmas-de-entrega-y-devolucion.md` (se retiró la referencia a conservar la firma en almacenamiento local)

**Eliminado**

- `src/modules/rentals/presentation/quick-rental-workspace.tsx` (flujo unitario sin ruta activa).

No se modificaron migraciones SQL, RLS, autenticación, `DashboardShell` ni el inventario general.
