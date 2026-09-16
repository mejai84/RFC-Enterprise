---
estado: vigente
propietario: Equipo RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Dirección, Desarrollo y Operación
---

# Registro de decisiones arquitectónicas y de producto

Este registro conserva decisiones que afectan el rumbo del producto. Una decisión no se elimina: si cambia, se agrega una nueva entrada que indique cuál reemplaza.

## ADR-001 · Monolito modular

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** RFC Enterprise crecerá a múltiples procesos, pero está en una etapa inicial donde varios despliegues y repositorios independientes añadirían complejidad innecesaria.

**Decisión.** Mantener una aplicación Next.js con límites explícitos entre `core`, `shared`, `modules` y `app`.

**Consecuencia.** La entrega es simple de desplegar, pero los límites de importación deberán revisarse en cada cambio. Si un dominio requiere escalar de forma autónoma en el futuro, se tomará una nueva decisión documentada.

---

## ADR-002 · Usuario no es trabajador

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** La cuenta que ingresa al ERP y el expediente de una persona empleada tienen ciclos de vida distintos.

**Decisión.** Modelar usuarios de plataforma por separado de trabajadores del futuro módulo de Talento Humano.

**Consecuencia.** Una persona empleada podrá tener o no una cuenta de usuario, y la identidad no quedará acoplada a contratos, nómina o datos laborales.

---

## ADR-003 · Permisos por código, no por banderas de interfaz

**Fecha:** 2026-09-15  
**Estado:** Aceptada

**Contexto.** Banderas como `isAdmin` o `isAlmacenista` no escalan para varios módulos y responsabilidades.

**Decisión.** Definir roles compuestos por permisos con códigos estables, por ejemplo `core.users.manage` e `inventory.movements.create`.

**Consecuencia.** La versión actual sólo define la base de Core; antes de flujos reales habrá que completar permisos por módulo y aplicarlos del lado servidor.

---

## ADR-004 · Datos semilla y persistencia híbrida

**Fecha:** 2026-09-15 (Actualizada 2026-09-16)  
**Estado:** Aceptada

**Contexto.** Se requería operar con el catálogo completo de 1,191 productos reales de RFC garantizando fluidez tanto en entornos locales como conectados a Supabase.

**Decisión.** Normalizar el catálogo completo como base reactiva con persistencia local (`localStorage`) sincronizable con el backend de Supabase.

---

## ADR-005 · Autenticación Supabase Auth

**Fecha:** 2026-09-16
**Estado:** Aceptada

**Contexto.** Se requería un sistema de autenticación seguro, validado en servidor, con tokens JWT y recuperación de credenciales.

**Decisión.** Adoptar Supabase Auth gestionado con `@supabase/ssr` e identidades verificadas por correo.

---

## ADR-007 · Confirmación y Preservación Obligatoria de Documentación

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Para evitar pérdida de contexto o desviaciones de alcance, todo acuerdo, modelo de datos y diseño funcional debe ser registrado inmediatamente en la carpeta `docs/`.

**Decisión.** Exigir la confirmación explícita de archivos guardados y un resumen de acuerdos al usuario en cada iteración del asistente AI.

---

## ADR-008 · Rediseño del Dashboard Principal y Extensiones Operativas de Inventario

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Se necesitaba elevar la visibilidad del estado financiero de los proyectos desde la pantalla principal (`/dashboard`) y proveer formatos de remisión imprimibles, requisiciones de obra, custodia de herramientas y devoluciones de sobrantes.

**Decisión.** 
1. Rediseñar `/dashboard` como un **Panel Ejecutivo de Obras y Materiales**, mostrando métricas consolidadas, semáforos de avance presupuestal por proyecto y accesos a operaciones de almacén.
2. Implementar vales de salida imprimibles (remisión con espacio de firmas para archivo físico o PDF).
3. Añadir la gestión de requisiciones de frente de obra, custodia de herramientas entregadas a trabajadores y devoluciones de material sobrante a bodega.

---

## ADR-009 · Módulo y Ruta Dedicada de Proyectos / Obras (/projects)

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** El usuario requiere una vista específica y profunda para inspeccionar la Ficha de Obra completa: materiales e insumos gastados por proyecto, herramientas en custodia y requisiciones de frente de trabajo.

**Decisión.** Crear la ruta dedicada `/projects` con navegación en la barra lateral del portal y la vista `ProjectsWorkspace` para la inspección detallada de obras, presupuestos y kardex de insumos imputados.

---

## ADR-010 · Niveles de Empleado (RBAC), Visibilidad de Dashboard y Separación de Rutas

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Contexto.** Se detectaron dos necesidades clave:
1. En la barra de navegación lateral se seleccionaban simultáneamente "Inventarios" y "Movimientos" porque ambos apuntaban a `/inventory` y compartían el mismo icono.
2. Es indispensable formalizar la jerarquía de roles de empleados (RBAC) y la matriz de qué información puede ver cada nivel en el Dashboard y la plataforma.

**Decisión.**
1. **Separación de rutas de navegación:**
   - `/dashboard`: Panel Ejecutivo, Inteligencia de Costos y Saludo Contextual (Icono `grid`).
   - `/projects`: Ficha de Obras, Centros de Costo y Materiales Gastados (Icono `building`).
   - `/inventory`: Catálogo de 1,191 insumos, niveles de stock y ajuste de mínimos (Icono `boxes`).
   - `/movements`: Kardex general de entradas, salidas por obra, devoluciones y remisiones (Icono `arrows`).
2. **Matriz de 5 Niveles de Empleado y Visibilidad:**
   - **Nivel 1: Administrador / Gerencia General**: Acceso total, finanzas en COP, presupuestos globales, ranking de materiales costosos, auditoría y parametrización.
   - **Nivel 2: Ingeniero Residente / Director de Obra**: Fichas de sus obras a cargo, avance presupuestal de su obra, aprobación de requisiciones y custodia de herramientas. No ve finanzas corporativas globales.
   - **Nivel 3: Jefe de Almacén / Bodeguero**: Prioridad en alertas de stock crítico bajo mínimo, requisiciones pendientes, emisión de vales/remisiones y control de préstamos de herramientas.
   - **Nivel 4: Maestro de Obra / Cuadrilla**: Solicitudes rápidas de materiales desde frente de obra, consulta de herramientas recibidas y registro de sobrantes.
   - **Nivel 5: Auditor / Contador de Costos**: Kardex valorizado, remisiones históricas, auditoría de consumos y balances financieros sin modificación física de inventario.
3. **Paneles de Inteligencia en Dashboard:** Top 5 materiales más costosos despachados, gráfico comparativo de gasto por obra, tabla de stock crítico bajo mínimo, saludo contextual y sistema de notificaciones toast.

---

## ADR-011 · Calendario operativo de proyectos

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Decisión.** Cada obra registra fecha de inicio, fecha estimada de finalización y estado (`pending`, `active`, `on_hold`, `completed`). La base de datos impide fechas finales anteriores al inicio y protege los registros con RLS para miembros autorizados de la empresa.

La edición inicia con un selector visual de obras y abre el formulario únicamente para la obra elegida. Los ajustes de presupuesto se mantienen como una acción financiera separada para auditar su historial.

---

## ADR-012 · Operaciones auditables de inventario

**Fecha:** 2026-09-16  
**Estado:** Aceptada

**Decisión.** Inventarios centraliza ubicaciones detalladas, recepciones de compra, conteos físicos con aprobación, puntos de reorden, movimientos valorizados, ajustes presupuestales y registros de auditoría en Supabase. Una salida exige una obra activa; los datos se protegen con RLS por empresa y roles de inventario.

**Consecuencia.** El script `20260916_inventory_operations.sql` debe aplicarse en Supabase antes de habilitar la sincronización de escritura en producción.

**Extensión.** La creación de un artículo incluye su cantidad y costo iniciales y produce un movimiento de entrada, evitando existencias sin trazabilidad.
