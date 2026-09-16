# Activación de Supabase

RFC Enterprise ya tiene el esquema del ERP y el inventario inicial cargados en Supabase. La aplicación usa `@supabase/ssr` para mantener la sesión en cookies y validar el JWT en el servidor.

## Variables de entorno

En desarrollo, copie `.env.example` a `.env.local` y complete:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

En el hosting registre las mismas variables como secretos de entorno. La clave publicable es apta para el navegador; nunca use ni exponga una clave `service_role`.

## Primer administrador

1. Cree el usuario desde **Authentication → Users** en Supabase o habilite un flujo de alta controlado.
2. Verifique el correo si la confirmación está activa.
3. Inserte su asignación de rol `administrator` en `public.user_roles`, vinculada a la empresa `rfc` y a la sede `caucasia`.
4. Inicie sesión mediante `/login` y compruebe que el catálogo de `/inventory` muestra los datos de la base de datos.

El perfil del usuario se crea automáticamente mediante el trigger `auth_user_profile`; no se debe almacenar una contraseña en el repositorio ni en scripts SQL.

## Estado actual

- El login valida correo y contraseña mediante Supabase Auth cuando las variables existen.
- Las rutas de Dashboard e Inventario validan el JWT con `getClaims`.
- El catálogo de Inventario lee `inventory_stock` e `inventory_items` bajo RLS.
- El formulario de movimientos continúa en modo de interfaz hasta conectar su escritura al endpoint transaccional y a auditoría.

## Migraciones

El esquema fuente está en `supabase/sql/initial_erp_schema.sql`. Cuando el CLI esté disponible en la terminal local, recupere la migración remota y verifique su historial:

```bash
npx supabase db pull initial_erp_schema --local --yes
npx supabase migration list --local
```
