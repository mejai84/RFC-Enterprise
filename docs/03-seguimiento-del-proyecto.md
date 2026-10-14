---
estado: vigente
propietario: Líder de proyecto RFC Enterprise
ultima_actualizacion: 2026-09-15
audiencia: Dirección, Producto, Desarrollo y Operación
---

# Seguimiento del proyecto

## Corte 2026-10-14 - Mejoras de Cotizaciones (expediente, comparador e indicadores)

**Alcance:** unicamente el modulo de Cotizaciones y un vista de lectura en Informes. No se toco APU, Inventarios, Compras, seguimiento comercial, rentabilidad ni el flujo de estados de la cotizacion.

**Entregado:**

1. **Expediente comercial** (`quote_commercial_documents`, bucket privado `quote-commercial-documents`, componente `CommercialFileSection`). Soporte por tipo, nombre, fecha, responsable y archivo o enlace. RLS, RPC `security definer` y auditoria en `public.audit_logs`.
2. **Comparador de revisiones** (`quote_revision_snapshots` + trigger, componente `RevisionComparator`). Solo lectura, marca solo lo que cambio y explica las limitaciones de datos historicos.
3. **Indicadores comerciales** (`src/modules/reports`, ruta `/reports/cotizaciones`). Ganadas/perdidas, tasa de adjudicacion, tiempo por etapa, vencidas y sin seguimiento, motivos de perdida, con filtros por periodo, responsable y cliente. Cada consulta queda auditada.

**Decisiones:** ADR-151 a ADR-154 en el registro de decisiones.

**Pendiente de la direccion tecnica:** montar `CommercialFileSection` y `RevisionComparator` dentro de `quotes-workspace.tsx`. Los componentes se entregan autocontenidos y con CSS propio para que esa integracion no entre en conflicto con otros trabajos sobre la misma pantalla.

**Riesgos vigentes:** COT-018 a COT-021 en el backlog.

---

## Tablero ejecutivo

| Área | Estado | Evidencia | Siguiente hito |
| --- | --- | --- | --- |
| Identidad y sitio institucional | Verde | Sitio publicado con identidad RFC | Validar contenido corporativo final |
| Arquitectura modular | Verde | `src/core`, `src/modules`, `src/shared` y reglas documentadas | Mantener límites al agregar casos de uso |
| Dashboard | Amarillo | Interfaz demostrativa publicada | Conectar indicadores a datos reales |
| Inventarios | Amarillo | Catálogo real inicial importado y movimientos demostrativos por sesión | Definir persistencia y flujo transaccional |
| Acceso de aplicación | Rojo | Sólo pantalla demostrativa y control de hosting | Implementar autenticación y autorización propias |
| Control de código en GitHub | Amarillo | Repositorio designado | Autorizar subida y confirmar rama principal |
| Operación productiva | Rojo | Sin DB, backup, monitoreo ni auditoría real | Diseñar plataforma operativa antes de lanzar flujos reales |

## Estado del corte actual

**Versión de trabajo:** 0.1.0  
**Corte:** 2026-09-15  
**Objetivo del corte:** establecer presencia digital, base ERP modular, dashboard e Inventarios inicial.  
**Resultado:** cumplido como base visual/documental; no apto aún para registrar operación real.

## Trabajo terminado

- Sitio institucional y acceso al portal.
- Branding de RFC Enterprise.
- Estructura de Core y del módulo Inventarios.
- Dashboard rediseñado y vista de existencias.
- Documentación inicial de agencia y proceso de seguimiento.

## Próximas prioridades propuestas

1. `OPS-001`: establecer repositorio principal, rama protegida y despliegue reproducible desde GitHub.
2. `CORE-001`: decidir almacenamiento de datos y modelo de autenticación/roles.
3. `INV-001`: implementar catálogo de productos con persistencia, validaciones y permisos.
4. `INV-002`: implementar entradas, salidas, ajustes y auditoría de movimientos.
5. `QA-001`: introducir pruebas, CI y checklist automatizado de calidad.

## Cadencia recomendada

- **Diario de desarrollo:** actualizar tarea activa, bloqueo y decisión tomada.
- **Semanal:** emitir el [informe semanal](templates/informe-semanal.md) con avance, riesgos, costos/plazo si aplican y decisiones requeridas.
- **Antes de publicar:** ejecutar checklist de calidad, confirmar aprobador y actualizar `CHANGELOG.md`.
- **Al finalizar una fase:** hacer demostración, validar criterios de aceptación y registrar retrospectiva.

## Semáforo

- **Verde:** completado o sin riesgo relevante.
- **Amarillo:** entregado parcialmente, en validación o con dependencia pendiente.
- **Rojo:** bloqueado, no iniciado o no apto para operación.
