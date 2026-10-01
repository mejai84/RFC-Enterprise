# Historial de cambios

Este archivo registra cambios funcionales visibles y decisiones de entrega. Sigue el formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido

- Alta de proyectos con tipo (Obra, Mantenimiento u Otro) y código consecutivo automático por tipo y fecha de inicio.
- Formato automático de pesos colombianos en presupuestos, costos y ajustes al abandonar el campo.
- Gestión de personal de obra mediante una lista que permite agregar y retirar empleados activos por proyecto.
- Registro interactivo de entradas, salidas y ajustes de Inventarios dentro de la sesión demostrativa.
- Validación de cantidades y prevención de existencias negativas en la interfaz.
- Catálogo inicial de 1.191 artículos importado desde la fuente de Inventarios proporcionada.
- Búsqueda y filtro por inventario, producto, marca, categoría y ubicación.

- Registro automático de fecha y hora en cada despacho, con fecha real de entrega manual al finalizar una obra.
- Custodia funcional de herramientas por obra: asignación desde existencias, responsable, devolución y registro de novedades.
- Botón visible para asignar herramientas y opción de anular asignaciones activas hechas por error.
- Clasificación operativa del catálogo y búsqueda de herramientas/equipos disponibles al asignar custodia.
- Reorganización de pestañas de obra e iconos SVG específicos para cada función.
- Ajustes de presupuesto ubicados al final de las pestañas de obra como consulta informativa.
- Búsqueda de catálogo con coincidencias en vivo y formularios de configuración de inventario alineados con icono SVG.

### Documentado

- Paquete inicial de documentación de producto, arquitectura, operación y seguimiento.

## [0.1.0] - 2026-09-15

### Añadido

- Sitio institucional de Representaciones Figueroa Castro con identidad RFC.
- Base de arquitectura de monolito modular para RFC Enterprise.
- Core inicial: auth, users, roles, permissions, modules, companies, branches, audit y settings.
- Dashboard operativo demostrativo.
- Módulo visual inicial de Inventarios con productos, existencias, mínimos y movimientos de muestra.

### Limitaciones conocidas

- No hay persistencia, autenticación propia, autorización aplicada ni auditoría funcional.
- Los indicadores y datos de Inventarios son de demostración.
