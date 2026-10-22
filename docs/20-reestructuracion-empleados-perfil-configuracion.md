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
