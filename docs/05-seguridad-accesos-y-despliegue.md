---
estado: vigente
propietario: Operación RFC Enterprise
ultima_actualizacion: 2026-09-15
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

## Requisitos antes de producción operativa

- Autenticación y sesión seguras.
- Autorización aplicada del lado servidor.
- Persistencia con migraciones, respaldo y recuperación probados.
- Auditoría de acciones sensibles.
- Monitoreo, alertas y proceso de incidentes.
- Dominio, HTTPS, responsables de acceso y política de retención definidos.
- CI/CD desde el repositorio canónico de GitHub.

