# Historial de cambios

Este archivo registra cambios funcionales visibles y decisiones de entrega. Sigue el formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido

- Registro interactivo de entradas, salidas y ajustes de Inventarios dentro de la sesión demostrativa.
- Validación de cantidades y prevención de existencias negativas en la interfaz.
- Catálogo inicial de 1.191 artículos importado desde la fuente de Inventarios proporcionada.
- Búsqueda y filtro por inventario, producto, marca, categoría y ubicación.

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
