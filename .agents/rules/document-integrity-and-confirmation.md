# Regla Permanente de Documentación y Confirmación Obligatoria

Toda interacción y desarrollo en **RFC Enterprise** debe cumplir estrictamente con los siguientes principios:

1. **Documentación Obligatoria**:
   - Cada nueva funcionalidad, cambio arquitectónico, modelo de datos o idea de negocio aprobada DEBE documentarse y actualizarse formalmente en la carpeta `docs/`.
   - Se debe mantener la coherencia entre el código implementado y los documentos:
     - `docs/00-vision-y-alcance.md`
     - `docs/01-arquitectura.md`
     - `docs/02-modulos-y-roadmap.md`
     - `docs/06-backlog-y-riesgos.md`
     - `docs/07-registro-de-decisiones.md` (ADRs)
     - `docs/09-costeo-proyectos-y-materiales.md` (Fichas de módulo)

2. **Confirmación y Notificación Explícita al Usuario**:
   - En cada respuesta donde se creen, actualicen o modifiquen documentos, el asistente DEBE **confirmar explícitamente al usuario la lista exacta de documentos guardados y resumir los puntos asentados en cada uno**.
   - El usuario debe tener visibilidad total de que su conocimiento y decisiones quedaron registrados de forma indeleble.
