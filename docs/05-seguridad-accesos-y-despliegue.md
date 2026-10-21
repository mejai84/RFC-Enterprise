---
estado: vigente
propietario: Operación RFC Enterprise
ultima_actualizacion: 2026-10-21
audiencia: Operación, Desarrollo y Dirección
---

# Seguridad, accesos y despliegue

## Estado de seguridad actual

El sitio publicado utiliza el control de acceso proporcionado por la plataforma de hosting. La aplicación por sí misma todavía no mantiene sesiones, contraseñas, tokens ni una autorización aplicada por rol.

Esto es suficiente para proteger una demostración privada, pero **no equivale a autenticación empresarial completa**. No se deben cargar ni procesar datos operativos sensibles hasta implementar los controles descritos en el roadmap.

## Reglas de acceso

- La gestión de acceso al sitio la realiza un administrador de la plataforma de hosting.
- El acceso del administrador inicial debe provisionarse fuera del repositorio.
- No se almacenan ni se solicitan contraseñas de usuarios en código, documentación, capturas ni tickets.
- Los permisos futuros deben expresarse como códigos (`core.users.manage`, `inventory.movements.create`, etc.) y verificarse en servidor, no sólo ocultarse en la interfaz.
- Los datos personales de personas autorizadas deben migrarse a un sistema de identidad o base de datos segura cuando exista backend.

## Secretos y configuración

1. Los secretos sólo viven en el administrador seguro de variables de entorno del proveedor aprobado.
2. Los archivos `.env*` nunca se versionan; se documentan nombres de variables, no valores.
3. Los tokens de publicación, llaves API y credenciales se rotan inmediatamente si llegan a aparecer en un commit, pantalla o conversación.
4. No se copian datos de producción a fixtures, pruebas o capturas.

## Publicación actual

La aplicación se configura para exportación estática. El proveedor de hosting genera el artefacto de `out` desde el código aprobado.

### Checklist de publicación

- [ ] Rama y commit de entrega identificados.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` verificados.
- [ ] Rutas críticas revisadas: inicio, acceso, dashboard e Inventarios.
- [ ] Vista móvil y enlaces externos revisados.
- [ ] Documentación, backlog y changelog actualizados.
- [ ] Sin secretos, datos reales sensibles ni archivos locales incluidos.
- [ ] Aprobación funcional registrada.
- [ ] URL publicada verificada después del despliegue.

## Reversión

Si una publicación presenta un fallo:

1. detenga cambios adicionales y registre el incidente;
2. restablezca la última versión publicada que pasó el checklist;
3. compruebe rutas críticas y control de acceso;
4. documente causa, impacto, corrección y acción preventiva en el informe semanal o el registro de decisiones.

## Auditoría y Endurecimiento de Seguridad — 2026-09-21

Se ejecutó una auditoría completa del repositorio cubriendo 12 áreas y se implementaron de forma integral las 22 recomendaciones y mitigaciones priorizadas:

### Mitigaciones críticas implementadas (2026-09-21)

1. ✅ **`src/middleware.ts`**: Implementado con `@supabase/ssr` para refresco automático de cookies de sesión e intercepción de todas las rutas privadas (`/dashboard`, `/inventory`, `/projects`, `/movements`, `/employees`, `/counts`, `/reports`), redirigiendo a `/login` a cualquier usuario no autenticado.
2. ✅ **`requireAuthenticatedUser()` reforzado**: Redirige obligatoriamente con `redirect("/login")` ante la ausencia de sesión activa o falta de configuración, impidiendo la fuga de datos en Layouts y Server Components.
3. ✅ **Eliminación del bypass de autenticación demo**: El formulario de login ya no redirige sin credenciales; valida contra Supabase Auth y muestra errores pertinentes. Se eliminó la exposición del correo administrador como valor predeterminado y se sanearon los registros de consola.
4. ✅ **Headers HTTP de seguridad**: Se configuró la suite completa de cabeceras de protección (HSTS preload, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy) tanto en `next.config.ts` como a nivel de CDN en `vercel.json`.
5. ✅ **Política de contraseñas endurecida**: `minimum_password_length = 10` y requisito obligatorio `lower_upper_letters_digits_symbols`.
6. ✅ **Confirmación de correo y protección de sesión activada**: `enable_confirmations = true`, `secure_password_change = true`, `max_frequency = "60s"`, sesión con límite de 24 horas y timeout por inactividad a 8 horas.
7. ✅ **Transición a Next.js SSR**: Se eliminó `output: "export"` permitiendo la ejecución nativa de middleware, cabeceras seguras dinámicas y la API route de restablecimiento de contraseña (`/api/employees/password-reset`) en hosting Serverless/Vercel.

### Mitigaciones complementarias implementadas

- **API Route `/api/employees/password-reset`**: Rate limiting en memoria (5 req/min), validación estricta de UUID y complejidad de contraseña, y registro de eventos en la tabla `audit_logs`.
- **Base de Datos**: Migración `20260921000000_security_hardening.sql` agregando `pg_temp` al `search_path` de las funciones de schema `private` y revocación de permisos a roles públicos.
- **Configuración Supabase**: `auto_expose_new_tables = false` y `[storage.s3_protocol] enabled = false`.
- **Gestión de Secretos**: `.env.example` actualizado documentando `SUPABASE_SECRET_KEY` exclusivamente para server-side.
- **Código Fuente**: Eliminación de datos personales del administrador hardcoded en `src/core/users/index.ts`.

## Requisitos antes de producción operativa

- Autenticación y sesión seguras (implementadas).
- Autorización aplicada del lado servidor (implementada).
- Persistencia con migraciones, respaldo y recuperación probados.
- Auditoría de acciones sensibles (registrada en `audit_logs`).
- Monitoreo, alertas y proceso de incidentes.
- Dominio, HTTPS, responsables de acceso y política de retención definidos.
- CI/CD desde el repositorio canónico de GitHub.

## Canales externos y variables de entorno (2026-10-20)

Estas variables se configuran en el entorno de despliegue o en Supabase Edge Function Secrets. **No se guardan valores en el repositorio.**

| Variable | Dónde | Uso |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | Servidor Next.js | Invitaciones de empleados, sincronización de membresía y auditoría de importaciones. Nunca se expone al navegador. |
| `NEXT_PUBLIC_SUPABASE_URL` | Build de Next.js | URL pública de Supabase; también se usa como base de la función de contacto. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Build de Next.js | Clave publicable; las escrituras de inventario usan el JWT del usuario. |
| `NEXT_PUBLIC_SITE_URL` | Build de Next.js | Origen usado en los redirects de invitación/recuperación. Si falta, se usa el origen de la solicitud. |
| `NEXT_PUBLIC_CONTACT_FUNCTION_URL` | Build de Next.js | URL completa de la función de contacto. Si falta, se usa `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/contact-form`. |
| `RESEND_API_KEY` | Supabase Edge Function | Secreto del proveedor transaccional. |
| `CONTACT_TO_EMAIL` | Supabase Edge Function | Buzón corporativo receptor; hasta 3 correos separados por coma o punto y coma. |
| `CONTACT_FROM_EMAIL` | Supabase Edge Function | Remitente verificado en el proveedor. |
| `CONTACT_ALLOWED_ORIGIN` | Supabase Edge Function | Origen(es) permitidos por CORS, separados por coma. Es obligatoria: la funci?n falla cerrada si falta. |

**Controles aplicados:** las rutas de empleados validan el JWT y el rol administrador; la importación valida JWT, membresía de inventario y sede, y escribe con el JWT del usuario; la función de contacto es pública pero valida entrada, honeypot, tiempo mínimo, CORS y rate limit. La clave secreta solo se usa en el servidor. El rate limit de contacto es en memoria por isolate (R-008); para producción con alto tráfico se requiere un almacén compartido.

**Pendiente operativo:** configurar SMTP y redirect URLs de Supabase Auth, desplegar `contact-form` con `verify_jwt = false`, cargar los secrets, restringir CORS al dominio real y ejecutar una prueba de entrega con un buzón controlado.

### Inventario bajo RLS por empresa y sede (2026-10-21)

La migración `20261021153000_harden_inventory_movements_and_catalog.sql` cerró las escrituras directas de `inventory_stock` e `inventory_movements` para `authenticated` y `anon`. Las lecturas y mutaciones se resuelven con funciones `security definer` de `search_path` fijo y un resolvedor de permisos por empresa; las políticas RLS no invocan directamente el esquema `private`, sino envoltorios públicos mínimos con `execute` solo para `authenticated`. Las claves foráneas compuestas impiden asociar un movimiento a una obra o sede de otra empresa, y la idempotencia se garantiza por `(company_id, client_request_id)`. `service_role` sigue siendo exclusivo del servidor para auditoría e invitaciones.


