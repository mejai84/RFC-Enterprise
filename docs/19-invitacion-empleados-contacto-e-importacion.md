---
estado: vigente
propietario: Desarrollo RFC Enterprise
ultima_actualizacion: 2026-10-21
audiencia: Producto, Desarrollo, Operación y Dirección
---

# Invitaciones de empleados, contacto e importación de inventario

Esta entrega resuelve tres frentes independientes:

1. **R-007 · Invitación de empleados** desde Talento Humano.
2. **R-006 · Formulario público de contacto** con Edge Function.
3. **INV-011 · Importación masiva de inventario** con vista previa y auditoría.

La reparación posterior del libro mayor de inventario quedó documentada en la sección 4 y aplicó una migración coordinada el 2026-10-21. Todas las escrituras de negocio usan Supabase. Ningún flujo nuevo usa `localStorage` como confirmación de guardado.

## 1. Invitación de empleados (R-007)

### Flujo

- La ficha de Empleados muestra una tarjeta **Acceso al portal** con el estado de la identidad y el correo de la ficha.
- El administrador pulsa **Invitar por correo**. El servidor valida el JWT, exige rol `administrator` en la empresa de la ficha y comprueba que la ficha tenga sede y rol base.
- Si el correo no tiene cuenta en Supabase Auth, se usa `inviteUserByEmail`.
- Si el correo ya tiene cuenta, se vincula y se envía un enlace de recuperación para que la persona establezca su contraseña.
- Si la ficha ya tenía una cuenta válida, se sincroniza la membresía y no se envía un correo nuevo.
- La membresía se escribe en `user_roles` con la sede y el rol base de la ficha. Primero se asegura la fila nueva; después se eliminan las filas obsoletas. Así una escritura fallida no deja al usuario sin acceso.
- El cambio de `employees.profile_id` queda en `audit_logs` por el trigger existente. La vinculación y la sincronización también registran auditoría con el cliente service-role.

### Estados de la identidad

| Estado | Origen | Significado |
| --- | --- | --- |
| `not_invited` | Sin `profile_id` | La ficha no tiene cuenta vinculada. |
| `invited` | `invited_at` o `email_confirmed_at` nulo en Auth | La invitación está pendiente. |
| `active` | `last_sign_in_at` o `email_confirmed_at` | La cuenta ya ingresó o confirmó el correo. |
| `disabled` | `banned_until` futuro | La cuenta está deshabilitada en Auth. |
| `orphaned` | `profile_id` apunta a un usuario que ya no existe | La cuenta se eliminó o el vínculo quedó roto; se puede volver a invitar. |
| `linked` | Cuenta existente sin datos de invitación | La identidad está vinculada, pero no hay señales de ingreso. |

No se agregaron columnas de invitación. El estado se deriva de Supabase Auth y de `employees.profile_id`.

### Endpoints

| Ruta | Método | Autorización | Uso |
| --- | --- | --- | --- |
| `/api/employees/invite` | POST | JWT + `administrator` | Invitar, vincular o sincronizar una ficha. |
| `/api/employees/invitation-status` | GET | JWT + `administrator` | Consultar el estado de una ficha por `employeeId`. |

### Variables y configuración

- `SUPABASE_SECRET_KEY` en el servidor de Next.js. No se expone al navegador.
- `NEXT_PUBLIC_SITE_URL` (recomendada) para construir los redirects de invitación y recuperación. Si falta, se usa el origen de la solicitud.
- En Supabase Auth deben estar configurados el SMTP y las redirect URLs del sitio, incluyendo `/login` y `/restablecer-contrasena`.

### Limitaciones

- La entrega del correo depende de Supabase Auth y su SMTP. La cuenta puede quedar creada aunque el correo no llegue; la pantalla permite reintentar con recuperación.
- `user_roles` no tiene una restricción única `(user_id, company_id)`. La sincronización elimina los roles previos de esa empresa y conserva una membresía base; si se necesitan varios roles simultáneos, requiere una migración coordinada.
- Si una cuenta vinculada se elimina en Auth, la ficha queda en `orphaned` hasta volver a invitarla.

## 2. Contacto público (R-006)

### Flujo

- `src/app/contact-form.tsx` deja de abrir `mailto:` y envía un JSON a la Edge Function.
- La URL se toma de `NEXT_PUBLIC_CONTACT_FUNCTION_URL`; si no existe, se usa `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/contact-form`.
- La función está en `supabase/functions/contact-form/index.ts` y se despliega con `verify_jwt = false`.
- Valida nombre, correo, ubicación, tipo de necesidad, mensaje y longitudes. Aplica honeypot, trampa de tiempo y rate limit por IP y global.
- Entrega con Resend al buzón corporativo. No persiste datos personales en Supabase ni en `localStorage`.
- Los errores se devuelven con mensajes claros; el frontend muestra el resultado en la misma pantalla.

### Variables de la Edge Function

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `RESEND_API_KEY` | Sí | Secreto del proveedor. |
| `CONTACT_TO_EMAIL` | Sí | Buzón receptor; hasta 3 correos separados por coma o punto y coma. |
| `CONTACT_FROM_EMAIL` | Sí | Remitente verificado en el proveedor. |
| `CONTACT_ALLOWED_ORIGIN` | S? | Origen(es) permitidos para CORS, separados por coma. La funci?n rechaza solicitudes hasta configurarlo. |

### Seguridad y límites

- La función es pública por diseño: la portada no requiere sesión.
- El rate limit es **en memoria por isolate** (5 solicitudes por IP y 100 globales por 10 minutos). Al escalar o reciclar instancias se reinicia; una protección durable requiere un almacén compartido (R-008).
- No se registra el cuerpo del visitante en logs; solo el estado del proveedor.
- El CSP permite `https://*.supabase.co`; si se define `NEXT_PUBLIC_CONTACT_FUNCTION_URL` con un dominio propio, `next.config.ts` agrega automáticamente ese origen a `connect-src` en tiempo de build. Si el build se hace sin la variable y luego se cambia en runtime, hay que reconstruir.
- No se guardan secretos en el repositorio. La documentación solo contiene nombres de variables.

### Despliegue

```bash
supabase functions deploy contact-form --no-verify-jwt
supabase secrets set RESEND_API_KEY=... CONTACT_TO_EMAIL=... CONTACT_FROM_EMAIL=... CONTACT_ALLOWED_ORIGIN=...
```

La configuración de `verify_jwt = false` está en `supabase/config.toml`.

## 3. Importación masiva de inventario (INV-011)

### Ruta y archivos

- Pantalla: `/inventory/import`.
- Contrato y parser: `src/modules/inventory/domain/inventory-import.ts`.
- Repositorio de contexto: `src/modules/inventory/data/inventory-import-repository.ts`.
- Endpoint: `POST /api/inventory/import`.
- Interfaz: `src/modules/inventory/presentation/inventory-import-workspace.tsx`.
- Enlace desde el catálogo: botón **Importar CSV/XLSX** en Inventario.

### Flujo

1. El usuario descarga la plantilla CSV o prepara un XLSX.
2. La pantalla valida el archivo en el navegador y muestra filas válidas, filas con error, SKU existentes, columnas ignoradas y advertencias.
3. El usuario revisa y marca la confirmación explícita.
4. El servidor repite la validación con los SKU actuales de la empresa y crea solo las filas válidas.
5. Cada fila usa `create_inventory_item_with_opening_balance` con el JWT del usuario; por tanto se conservan `auth.uid()`, RLS y la autorización de inventario.
6. Se escribe un resumen de lote en `audit_logs` con el cliente service-role. La RPC y el trigger de movimientos ya registran los movimientos de cantidad mayor a cero.
7. El resultado informa creados, fallidos, errores de validación y advertencia de auditoría.

### Contrato de archivo

- Formatos: CSV y XLSX. Se lee la primera hoja del libro.
- Máximo: 500 filas y 2 MB.
- Columnas obligatorias (o sus alias): `sku`, `nombre`, `unidad`, `grupo`/`source_group`, `cantidad`.
- Columnas opcionales: `categoria`, `marca`, `ubicacion`, `stock_minimo`, `costo_unitario`, `notas`, `fila_origen`.
- La plantilla usa `source_group` para ser compatible con la carga inicial.
- Los encabezados se normalizan sin acentos, mayúsculas ni signos.
- En XLSX, la columna SKU debe estar formateada como texto para conservar ceros a la izquierda; Excel puede convertir `00123` en `123`. La plantilla y la vista previa ayudan a detectar la diferencia antes de confirmar.

### Reglas de validación

- SKU, nombre, unidad y grupo son obligatorios.
- El grupo debe ser `bodega`, `dotacion` o `trabajadores`.
- Cantidad, stock mínimo y costo unitario deben ser números mayores o iguales a cero.
- Se rechazan longitudes fuera de rango (SKU 80, nombre 240, unidad 40, etc.).
- Un SKU repetido dentro del archivo marca **todas** las filas del grupo para que el usuario conserve una.
- Un SKU que ya existe en la empresa se marca como error: la importación es de altas y no actualiza artículos existentes.
- Si no hay costo unitario, la fila se crea con costo 0 y valoración pendiente.
- El parser asume formato colombiano: `28.500` = 28500, `1.234,5` = 1234.5, `1,234.56` también se reconoce. La plantilla recomienda números sin separadores para evitar ambigüedad.
- Las filas con error no se importan. Si ninguna fila es válida, el servidor responde 422 y no escribe.

### Auditoría y fallos parciales

- El lote se identifica con un UUID y se registra en `audit_logs` como `entity_type = inventory_import`, `action = inventory_import_confirmed`.
- La escritura de las filas es secuencial por lotes de 4 para no saturar la conexión. Si una fila falla, las demás continúan y el resultado lista los fallos.
- Si falla la auditoría después de crear artículos, la operación no se revierte: se informa `auditWarning` y queda el rastro de los movimientos creados por la RPC.

### Limitaciones y riesgos

- `inventory_items.sku` no tiene restricción única (INV-026). La unicidad se valida en aplicación; dos solicitudes concurrentes o una carga externa podrían duplicar un SKU. Se requiere una migración coordinada y limpiar primero los SKU repetidos del inventario inicial.
- La importación no actualiza existencia de artículos existentes. Para sumar stock a un artículo ya creado se usa el movimiento de entrada o una RPC futura.
- Los SKU repetidos del inventario inicial documentados en [08 · Importación inicial](08-importacion-inventario-inicial.md) deben conciliarse antes de una recarga masiva.
- La operación no es una transacción única de todo el archivo: si se crean 10 y fallan 2, las 10 quedan creadas. El resumen lo informa de forma explícita.

## 4. Reparación del libro mayor de inventario

La auditoría de Inventario y Movimientos encontró que la interfaz ocultaba registros por el límite de 1.000 filas de PostgREST, que varias pantallas escribían `inventory_stock` e `inventory_movements` directamente y que los préstamos de herramientas cambiaban existencias sin dejar un asiento de Kardex. La reparación se aplicó con la migración:

- `supabase/migrations/20261021153000_harden_inventory_movements_and_catalog.sql` (**aplicada** en el proyecto vinculado `honalybezbcmwkttasmk` el 2026-10-21, registrada en el historial remoto como `20261021153000`).
- La migración local de conteo se alineó con el historial remoto: `20261020195950_secure_collaborative_physical_counts.sql` (antes `20261020195626`). No se reaplicó sobre producción.

### Libro mayor y RPC

- `register_inventory_movement` es la única vía para entradas, salidas, devoluciones y ajustes. Calcula el saldo antes/después, toma actor y fecha del servidor, aplica costo promedio y escribe en `audit_logs` mediante el trigger `private.apply_inventory_movement`.
- `relocate_inventory_stock` mueve la ubicación y registra un movimiento `transfer` en la misma transacción.
- `update_inventory_minimum` cambia el mínimo sin tocar existencias.
- `create_inventory_item_with_opening_balance` crea artículo, existencia y entrada de apertura en una sola operación.
- `issue_employee_dotacion` distingue entrega y devolución con `operation_kind`.
- `private.apply_tool_loan_stock` ya no modifica `inventory_stock` a mano: inserta una salida o devolución de préstamo y deja que el trigger del Kardex actualice el saldo.
- Se agregaron `operation_kind`, `client_request_id`, `quantity_before` y `quantity_after` a `inventory_movements`, un índice único de idempotencia por empresa y claves foráneas compuestas para impedir movimientos de otra empresa u obra.
- Se revocaron `insert/update/delete` directos sobre `inventory_stock` e `inventory_movements` para `authenticated` y `anon`; las pantallas existentes pasaron a RPC y releen el stock confirmado.
- Las políticas de lectura usan un resolvedor de permisos por empresa y aceptan los códigos nuevos (`inventory.items.read`, `inventory.stock.read`, `inventory.movements.read`, `inventory.reports.read`) además de los códigos anteriores.

### Interfaz y datos

- Las lecturas de inventario, movimientos, conteos, informes, alertas, alquileres, APU y dotación ahora recorren todas las páginas de PostgREST con `src/shared/supabase/load-all.ts`; ya no dependen de `max_rows = 1000`.
- `getInventoryProducts` ya no cae silenciosamente en datos demo.
- Se eliminó el costo ficticio de `$25.000`: un costo desconocido queda en cero y la pantalla lo muestra como **Pendiente**.
- Los despachos y devoluciones bloquean el doble envío, leen el stock real después de la RPC y conservan la referencia, el proyecto y el responsable.
- La exportación CSV neutraliza fórmulas y escapa comas, comillas y saltos de línea.
- Las barreras de servidor de `/inventory`, `/movements`, `/counts` y `/reports` se marcaron dinámicas para no prerenderizar datos con una sesión ausente.

### Validación de la migración

- La migración completa se ejecutó primero dentro de `begin; … rollback;` sobre la base vinculada, sin errores.
- Después de aplicarla se probaron con `rollback`: registro de entrada, idempotencia por `client_request_id`, traslado de ubicación, alta de artículo con saldo de apertura y trigger de préstamo/devolución.
- Los conteos de datos no cambiaron: 1.191 artículos, 1.191 existencias y 1.182 movimientos. Las pruebas posteriores se revirtieron y no dejaron filas de prueba.
- Los 1.182 movimientos históricos siguen siendo `adjustment_out`, con costo cero, mismo instante y `created_by = NULL`; no se inventaron actores ni fechas. La trazabilidad completa rige desde la migración en adelante.
- Las 1.191 existencias siguen en cero y el conteo abierto sigue con cero artículos contados. Es el punto seguro para corregir el saldo antes de iniciar la jornada.

## Verificación realizada

- `npx tsc --noEmit` sin errores.
- `npm run build` correcto; se generaron `/inventory/import`, `/api/employees/invite`, `/api/employees/invitation-status`, `/api/inventory/import` y las rutas dinámicas de inventario, movimientos, conteos e informes.
- Prueba de sintaxis de la Edge Function con el transpilador de TypeScript.
- Prueba manual del parser con CSV delimitado por coma y punto y coma, comillas, duplicados, SKU existente, números colombianos y columnas faltantes.
- Migración de inventario aplicada y validada con pruebas transaccionales revertidas (entrada, idempotencia, traslado, alta con apertura y préstamo).
- RLS verificada con la identidad de un administrador (claims de JWT en una transacción revertida): 1.191 existencias y 1.182 movimientos visibles antes de las pruebas.

## Pendientes operativos

1. Configurar SMTP y redirect URLs de Supabase Auth.
2. Configurar `NEXT_PUBLIC_SITE_URL` y probar invitación con un buzón real.
3. Desplegar `contact-form`, cargar secrets, restringir CORS y probar entrega real.
4. Probar la importación con un archivo real de Operación y definir la política de SKU duplicado.
5. Resolver INV-026 (unicidad durable de SKU) en una migración coordinada.
6. Cerrar el conteo físico y cargar el saldo real antes de registrar despachos; hoy todas las existencias están en cero.
7. Conciliar los 1.182 movimientos históricos sin actor, costo ni saldo antes/después; la base no permite reconstruirlos sin una fuente externa.
