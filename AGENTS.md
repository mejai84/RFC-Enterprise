<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## RFC Enterprise — Arquitectura ERP v0.1

Este repositorio es un **monolito modular** construido con Next.js App Router y TypeScript.

- `src/app`: rutas y composición de interfaz. Una página no contiene reglas de negocio.
- `src/core`: capacidades transversales: `auth`, `users`, `roles`, `permissions`, `modules`, `companies`, `branches`, `audit` y `settings`.
- `src/modules/<modulo>`: cada dominio de negocio. Un módulo expone su contrato público en `index.ts` y conserva sus detalles de implementación dentro de su carpeta.
- `src/shared`: tipos y utilidades realmente genéricas; no debe convertirse en un segundo Core.
- `docs/`: centro documental y fuente canónica de verdad del proyecto.

### Reglas de dependencia

1. Los módulos pueden depender de contratos explícitos de `core` y `shared`.
2. Core no puede depender de módulos de negocio.
3. Un módulo no importa detalles internos de otro módulo. Si se requiere integración, se crea un contrato público o un evento en Core.
4. Mantener persistencia, autorización y casos de uso detrás de interfaces por módulo.
5. Usar el alias `@/` para importaciones desde `src`.

### 📌 Regla de Documentación y Confirmación Obligatoria al Usuario

- **Obligación de Registro**: Toda nueva funcionalidad, modelo de datos, idea de negocio o cambio arquitectónico acordado con el usuario DEBE quedar registrado formalmente en la carpeta `docs/` (`02-modulos-y-roadmap.md`, `06-backlog-y-riesgos.md`, `07-registro-de-decisiones.md`, `09-costeo-proyectos-y-materiales.md`).
- **Confirmación Explícita**: En cada respuesta donde se actualicen o creen documentos, el asistente **debe listar y confirmar explícitamente al usuario los archivos guardados** y los acuerdos registrados.
