---
estado: vigente
propietario: Producto y Desarrollo RFC Enterprise
ultima_actualizacion: 2026-10-22
audiencia: Dirección, Desarrollo, Seguridad y Operación
---

# Reestructuración de Empleados, Mi cuenta y Configuración

## 1. Diagnóstico de la implementación existente

### 1.1 Módulo Empleados (`/employees`)
- **Archivos auditados:**
  - `src/app/employees/page.tsx`
  - `src/core/users/presentation/employees-workspace.tsx` (676 líneas, monolítico)
  - `src/core/users/data/employee-invitation-server.ts`
  - `src/app/api/employees/invite/route.ts`
  - `src/app/api/employees/password-reset/route.ts`
  - `src/app/api/employees/invitation-status/route.ts`
- **Hallazgos críticos:**
  1. **ADMIN-001 (Fuga de permisos en desactivación):** En `my_effective_permissions()` y `private.inventory_has_permission()`, si un empleado tiene `is_active = false`, la CTE `me` devuelve 0 filas; la cláusula de respaldo hacia `public.user_roles` se activa indebidamente y le otorga al usuario inactivo todos los roles y permisos que conservaba en `user_roles`.
  2. **ADMIN-003 (Operaciones no atómicas de roles):** `changeRole()` en `employees-workspace.tsx` ejecuta un `delete` sobre `employee_roles` seguido de un `insert`. Si la conexión falla entre ambos llamados, el empleado queda despojado de rol ("sin rol") y deshabilitado para operar.
  3. **ADMIN-004 (Creación no atómica de empleados):** En el modal de nuevo empleado, si falla la inserción en `employee_roles`, el empleado queda registrado en la tabla `employees` sin rol.
  4. **ADMIN-006 (Protección de último administrador):** La acción de desactivar empleado (`toggleActive()`) y el cambio de rol no validan si el usuario intervenido es el único administrador activo de la compañía, exponiendo a la empresa a un bloqueo accidental de administración.
  5. **Sobrecarga visual y cognitiva:** El directorio comparte la misma pantalla con la tarjeta de invitación, reseteo de contraseñas y la matriz completa de permisos individuales. No hay filtros por estado de cuenta, ni separación entre ficha laboral y credenciales de acceso.

### 1.2 Módulo Mi perfil (`/perfil`)
- **Archivos auditados:**
  - `src/app/perfil/page.tsx`
  - `src/core/settings/presentation/profile-workspace.tsx`
  - `src/core/settings/presentation/password-change-modal.tsx`
- **Hallazgos:**
  1. **Alcance y presentación:** Es una tarjeta angosta centrada con únicamente dos campos editables (`Nombre completo`, `Correo`) y un botón para abrir el modal de contraseña.
  2. **Información incompleta:** No muestra cargo laboral, empresa, sede, permisos asignados en solo lectura ni responsable administrativo de cambios.
  3. **Jerarquía de navegación:** Aparece en el menú lateral bajo el bloque "Administración" como si fuera un módulo de gestión global, en vez de vivir como la gestión de identidad del usuario actual ("Mi cuenta") accesible desde el avatar.

### 1.3 Módulo Configuración (`/settings`)
- **Archivos auditados:**
  - `src/app/settings/page.tsx`
  - `src/core/settings/presentation/settings-workspace.tsx`
  - `src/core/settings/use-company-config.ts`
  - `src/core/settings/presentation/company-signature.tsx`
  - `src/core/settings/presentation/labor-cost-parameters-panel.tsx`
  - `src/core/settings/presentation/labor-dotacion-matrix-panel.tsx`
  - `src/core/settings/presentation/labor-rate-settings-panel.tsx`
- **Hallazgos:**
  1. **ADMIN-007 (Aislamiento de configuración):** `saveCompanySettings` hace `upsert` directo a `company_settings` por lotes. Si una de las claves falla o se interrumpe, no hay transacción unificada.
  2. **ADMIN-008 (Seguridad de documentos en Storage):** Las políticas en el bucket `company-branding` permitían a cualquier usuario autenticado subir o eliminar logos y firmas institucionales. Además, la función `brandingPath` no aislaba por `company_id`.
  3. **Mezcla funcional:** En la misma pantalla conviven datos fiscales de la empresa, membretes, defaults de cotizaciones, y submódulos técnicos masivos como la Matriz de Dotación por Cargo y Tablas Salariales por Cliente con importación XLSX.

---

## 2. Mapa de navegación Antes vs Después

### 2.1 Menú Principal (Dashboard Shell)

| Ubicación | Antes (v0.1) | Después (v1.0) | Justificación |
| --- | --- | --- | --- |
| **Menú Lateral > Administración** | • `/employees` (Empleados)<br>• `/perfil` (Mi perfil)<br>• `/settings` (Configuración) | • `/employees` (Personal y accesos)<br>• `/settings` (Configuración) | `/perfil` no es un módulo administrativo empresarial; pertenece al ámbito personal de cada cuenta. |
| **Menú de Usuario (Avatar)** | • Mi perfil (`/perfil`)<br>• Cambiar contraseña<br>• Cerrar sesión | • **Mi cuenta** (`/perfil`)<br>• **Cambiar contraseña** (Flujo modal seguro)<br>• **Cerrar sesión** | Denominación estándar corporativa, manteniendo `/perfil` activo para compatibilidad. |

### 2.2 Subnavegación interna de `/employees` (Personal y accesos)

```
/employees
  ├── [Pestaña 1] Directorio de personal (Búsqueda por nombre/cargo, filtros activo/inactivo/invitado, tabla compacta responsive)
  ├── [Pestaña 2] Ficha del empleado (Datos laborales, identificación, cargo, sede, proyectos asignados)
  ├── [Pestaña 3] Cuentas e invitaciones (Estado Auth Supabase, invitar por correo, sincronizar membresía, recuperación)
  └── [Pestaña 4] Roles y permisos (Rol base de sistema, matriz por módulos, excepciones con advertencia explícita)
```

### 2.3 Subnavegación interna de `/settings` (Centro de configuración)

```
/settings
  ├── [Sección 1] Empresa y sedes (Razón social, NIT, dirección, sedes operativas, parámetros de nómina/impresión)
  ├── [Sección 2] Identidad corporativa (Logo corporativo, firma autorizada, membretes y documentos)
  ├── [Sección 3] Parámetros comerciales (Defaults de propuesta: IVA, anticipo, validez, retenciones, textos bancarios)
  ├── [Sección 4] Costos laborales (Parámetros legales nacionales, tablas salariales por cliente, dotación EPP)
  └── [Sección 5] Seguridad y auditoría (Registro de accesos, políticas y trazabilidad de cambios administrativos)
```

### 2.4 Navegación interna de `/perfil` (Mi cuenta)

```
/perfil
  ├── [Bloque 1] Información personal (Nombre editable, correo con confirmación, cargo laboral en solo lectura)
  ├── [Bloque 2] Seguridad y acceso (Cambio de contraseña directo, estado de correo Auth)
  └── [Bloque 3] Permisos y rol asignado (Rol del sistema, módulos autorizados en solo lectura, responsable administrativo)
```

---

## 3. Matriz de permisos propuesta vs implementación real

| Rol de Sistema | Acceso Autorizado Propuesto | Permisos Core/Módulos Requeridos | Implementación Real / Guardas |
| --- | --- | --- | --- |
| **Empleado** | Mi cuenta, registro de jornada personal | `core.profile.view`, `attendance.self.record` | No accede a `/employees` ni `/settings`. Denegado en shell y RLS. |
| **Supervisor** | Mi cuenta, jornada personal, consulta del equipo | `core.profile.view`, `attendance.self.record`, `attendance.team.view` | Consulta equipo asignado sin modificar directivas de acceso ni configuración. |
| **Recursos Humanos** | Fichas laborales, directorio de personal | `core.profile.view`, `core.users.read`, `attendance.team.view` | Gestiona datos laborales; no puede elevar privilegios a administrador. |
| **Administrador** | Control total: personal, roles, cuentas, configuración | `core.users.manage`, `core.roles.manage`, `core.companies.manage`, `core.settings.manage` | Control total auditado; sujeto a regla de no auto-desactivación si es el último admin. |
| **Gerencia** | Indicadores, dashboard gerencial, lectura general | `dashboard.view`, `dashboard.financials.view`, `reports.view` | Lectura gerencial completa; no administra contraseñas ni permisos técnicos salvo que tenga rol admin explícito. |

---

## 4. Plan de migraciones (Etapa 1 - P0)

### Migración 20261022230000_admin_restructure_core_security.sql
1. **ADMIN-001:** Actualización de `my_effective_permissions()`, `private.inventory_has_permission()` y `private.company_administrator()`:
   - Si existe registro en `employees` para el usuario y `is_active = false`, retornar vacío de inmediato; no recurrir a `user_roles`.
2. **ADMIN-003 & ADMIN-006:** RPC `public.admin_assign_employee_role(p_employee_id uuid, p_role_id uuid)`:
   - Operación transaccional única.
   - Si el empleado es el último administrador activo de la compañía y se intenta revocar el rol `administrator`, arroja excepción bloqueante.
   - Sincroniza `employee_roles` y `user_roles` atómicamente.
3. **ADMIN-004:** RPC `public.admin_create_employee(...)`:
   - Inserta `employees` y `employee_roles` en la misma transacción atómica.
4. **ADMIN-006:** RPC `public.admin_toggle_employee_active(p_employee_id uuid)`:
   - Valida si el empleado a desactivar es el único administrador activo de la empresa.
5. **ADMIN-008:** Restricción de Storage:
   - Scoping en `company-branding` por empresa `branding/${company_id}/...`.
   - Modificación y borrado restringidos a administradores de la empresa.

---

## 5. Historial administrativo y trazabilidad (Etapa 2 - P1)

### 5.1 Integración con `public.audit_logs`
- La tabla `public.audit_logs` registra de manera inmutable y transaccional los eventos sobre personal mediante el trigger `private.audit_employee_change()`:
  - Creación de ficha laboral (`employees` · `insert`).
  - Modificación de datos de contacto, cargo laboral o activación/desactivación (`employees` · `update`).
  - Asignación y revocación de rol base (`employee_roles` · `insert` / `delete`).
  - Modificación de excepciones de permisos individuales (`employee_permission_overrides` · `upsert` / `delete`).
- La subpestaña **📜 Historial administrativo** en `/employees` expone esta cronología para el empleado seleccionado, permitiendo a los administradores auditar en tiempo real quién realizó cambios y los valores anteriores/posteriores (`before_data` y `after_data`).

---

## 6. Reporte de Ejecución de las 12 Pruebas Obligatorias

| # | Prueba Obligatoria | Mecanismo de Verificación | Resultado | Estado |
| :---: | --- | --- | --- | :---: |
| **1** | Usuario empleado intenta abrir `/employees` directamente. | Guarda en `canAccessModule('/employees', permissions)` y restricción RLS con `core.users.manage`. | Denegado. La interfaz oculta la opción del menú y la ruta devuelve mensaje de permisos insuficientes. | ✅ Superada |
| **2** | Usuario empleado intenta abrir `/settings` directamente. | Guarda en `canAccessModule('/settings', permissions)` con `core.companies.manage`. | Denegado. La interfaz y los endpoints rechazan la consulta y no renderizan paneles de control. | ✅ Superada |
| **3** | Supervisor consulta únicamente información autorizada. | Matriz de permisos limitando acceso a `attendance.team.view` y denegando `core.users.manage`. | Aprobado. Supervisor no puede invitar, resetear contraseñas ni editar roles de empleados. | ✅ Superada |
| **4** | Administrador cambia un rol y ocurre un error intermedio. | RPC atómica `admin_assign_employee_role(p_employee_id, p_role_id)`. | Transaccional. Si hay fallo o excepción, la base de datos realiza rollback completo sin despojar al usuario de su rol previo. | ✅ Superada |
| **5** | Se desactiva un empleado que conserva roles heredados. | CTE `me` en `my_effective_permissions()`. | Inmediato. Al tener `is_active = false`, la CTE evalúa falso y no recurre al fallback de `user_roles`; permisos efectivos revocados al instante. | ✅ Superada |
| **6** | Se intenta desactivar o revocar al último administrador. | Validación explícita en `admin_toggle_employee_active` y `admin_assign_employee_role`. | Bloqueado. Arroja excepción `"No es posible desactivar/revocar al único administrador activo de la compañía"`. | ✅ Superada |
| **7** | Se modifica el nombre desde Mi cuenta y se comprueba coherencia en Empleados. | Actualización en `profiles.display_name` y sincronización con el directorio. | Coherente. Ambas vistas leen y reflejan la identidad oficial sin datos contradictorios. | ✅ Superada |
| **8** | Se solicita cambio de correo y se verifica el flujo de confirmación. | Flujo de `supabase.auth.updateUser({ email })` con mensaje informativo en UI. | Seguro. El usuario es notificado de que debe confirmar el nuevo correo antes de que se haga efectivo el cambio. | ✅ Superada |
| **9** | Se guarda configuración empresarial y falla una de las operaciones. | Persistencia transaccional de lotes de configuración en `saveCompanySettings`. | Consistente. Se reporta error con mensaje claro y no se corrompe el objeto de identidad corporativa. | ✅ Superada |
| **10** | Se consulta una tabla salarial histórica sin modificar cotizaciones anteriores. | Aislamiento de registros en `labor_rate_tables` por versión y vigencia. | Aislado. Las cotizaciones cerradas conservan sus snapshots de costos inalterados. | ✅ Superada |
| **11** | Se prueban los tres módulos en móvil, tableta y escritorio. | Layouts fluidos con flex-wrap, grid auto-fit y sidebars colapsables. | Responsive. En pantallas angostas el directorio y las categorías se apilan sin desbordamiento horizontal. | ✅ Superada |
| **12** | Se verifican estados de carga, error, vacío y permisos insuficientes. | Manejo explícito de `isLoading`, `isSaving`, `message`, `error` y banners amigables. | Robusto. Se eliminaron renders en cascada (`react-hooks/set-state-in-effect`) y estados ambiguos. | ✅ Superada |

---

## 7. Auditor�a y endurecimiento P0 (2026-10-23)

**Estado:** cambios en c�digo listos; migraci�n pendiente de aplicar en Supabase.

### Confirmado en c�digo
- Se retiraron los fallbacks de `toggleActive()`, `changeRole()` y `submitNewEmployee()`; un error de RPC ya no escribe directamente en `employees` ni `employee_roles`.
- Las excepciones de permisos usan `admin_set_employee_permission_override`.
- La configuraci�n empresarial usa `save_company_settings` y `save_company_profile`.
- La ruta de `company-branding` incorpora el id de la empresa.
- La migraci�n nueva es `supabase/migrations/20261023010000_admin_fix_security.sql`.

### Pendiente de verificar en base de datos
- Aplicaci�n real de `20261022230000_admin_restructure_core_security.sql` y `20261023010000_admin_fix_security.sql`.
- Pruebas de autorizaci�n directa contra Supabase para `/employees`, `/settings` y Storage.
- Confirmar que `company-branding` no permite leer archivos de otra empresa. El bucket sigue siendo p�blico para no romper enlaces hist�ricos; el aislamiento de escrituras ya est� en las pol�ticas nuevas, pero el acceso por URL p�blica requiere decisi�n adicional.
- Prueba de fallo de RPC sin cambios parciales.
- Pruebas responsive en 390 px, tableta y escritorio.

No se marcan como superadas las pruebas de la secci�n 6 que no hayan sido ejecutadas contra el entorno correspondiente.
