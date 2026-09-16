# Guía de colaboración

## Propósito

Esta guía define cómo un equipo de agencia entrega cambios consistentes para RFC Enterprise. Busca que cada mejora sea trazable, revisable y segura para la operación futura.

## Antes de comenzar

1. Revise [AGENTS.md](AGENTS.md), el [backlog](docs/06-backlog-y-riesgos.md) y las decisiones vigentes.
2. Confirme que el requerimiento tiene objetivo, alcance, criterio de aceptación y responsable de aprobación.
3. Identifique el módulo dueño del cambio. No agregue reglas de Inventarios dentro de Core ni dentro de una página.
4. Si el cambio afecta datos, permisos, integración o publicación, actualice la documentación correspondiente en el mismo cambio.

## Flujo de trabajo propuesto

1. Cree una rama con el formato `tipo/ID-descripcion-corta`, por ejemplo `feature/INV-001-productos` o `docs/OPS-001-despliegue`.
2. Mantenga los commits pequeños y con mensajes claros en imperativo: `Add inventory product service`.
3. Ejecute las verificaciones de calidad indicadas en la documentación.
4. Abra una solicitud de cambio que explique qué se modificó, cómo se verificó, riesgos y evidencia visual cuando aplique.
5. Obtenga revisión técnica y aprobación del responsable funcional antes de publicar.

## Convenciones de código

- Use TypeScript estricto y el alias `@/` para importaciones desde `src`.
- Una ruta compone interfaz; no contiene reglas de negocio ni acceso directo a persistencia.
- Core es transversal y no depende de módulos de negocio.
- Cada módulo expone su contrato público desde su propio `index.ts`.
- Evite dependencias entre detalles internos de módulos. Una integración se resuelve con un contrato explícito de Core o un evento definido.
- No incluya secretos, contraseñas, tokens, correos personales ni capturas con información sensible.

## Definition of Ready

Una tarea puede iniciar cuando tiene:

- resultado esperado y usuario beneficiado;
- criterio de aceptación comprobable;
- alcance y exclusiones claros;
- dependencias y riesgos identificados;
- diseño o referencia visual si cambia la experiencia.

## Definition of Done

Una tarea se considera terminada sólo cuando:

- el código y la documentación están actualizados;
- lint, tipos y construcción fueron verificados;
- los criterios de aceptación están comprobados;
- no hay secretos ni datos de producción incluidos;
- se registró el cambio en `CHANGELOG.md` cuando afecta una entrega;
- se aprobó y publicó siguiendo el checklist operativo.

