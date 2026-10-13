# Arquitectura ERP v0.1

Este repositorio es un **monolito modular** construido con Next.js App Router y TypeScript.

- `src/app`: rutas y composición de interfaz. Una página no contiene reglas de negocio.
- `src/core`: capacidades transversales: `auth`, `users`, `roles`, `permissions`, `modules`, `companies`, `branches`, `audit` y `settings`.
- `src/modules/<modulo>`: cada dominio de negocio. Un módulo expone su contrato público en `index.ts` y conserva sus detalles de implementación dentro de su carpeta.
- `src/shared`: tipos y utilidades realmente genéricas; no debe convertirse en un segundo Core.

### Reglas de dependencia

1. Los módulos pueden depender de contratos explícitos de `core` y `shared`.
2. Core no puede depender de módulos de negocio.
3. Un módulo no importa detalles internos de otro módulo. Si se requiere integración, se crea un contrato público o un evento en Core.
4. Mantener persistencia, autorización y casos de uso detrás de interfaces por módulo. No añadir un ORM, proveedor de autenticación ni lógica de negocio hasta que el flujo lo requiera.
5. Usar el alias `@/` para importaciones desde `src`.

La pantalla de acceso es sólo una maqueta navegable: no autentica usuarios ni almacena credenciales. El catálogo inicial de aplicaciones vive en `src/core/modules/catalog.ts`.

### Dos destinos de publicación

- `npm run build` produce la aplicación de Node (`next start`): es la que habilita Server Actions, cookies y sesión.
- `npm run build:static` produce `out/` para el hosting compartido con Apache, que no ejecuta Node. En ese destino quedan deshabilitadas las Server Actions y el resto de funciones que requieren servidor.

Las rutas internas viven en el route group `src/app/(app)`, que comparte el shell de navegación.
