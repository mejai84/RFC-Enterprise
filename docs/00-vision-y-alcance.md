---
estado: vigente
propietario: Producto RFC Enterprise
ultima_actualizacion: 2026-09-15
audiencia: Dirección, Producto y Desarrollo
---

# Visión y alcance

## Visión

RFC Enterprise será el punto de operación digital de Representaciones Figueroa Castro: una aplicación modular que permita ordenar información, roles, procesos y decisiones sin perder trazabilidad a medida que la empresa crece.

El sitio institucional y la aplicación tienen propósitos distintos:

| Frente | Propósito | Público |
| --- | --- | --- |
| Sitio institucional | Comunicar servicios y facilitar el contacto | Visitantes externos |
| RFC Enterprise | Apoyar la operación de la empresa | Usuarios autorizados |

## Objetivo de v0.1

Crear una base visual y técnica mantenible para el ERP: navegación, Core modular, dashboard y una primera representación del módulo de Inventarios.

## Incluido actualmente

- Identidad visual RFC y sitio corporativo.
- Rutas de inicio, acceso demostrativo, dashboard e Inventarios.
- Estructura de Core: identidad, usuarios, roles, permisos, empresas, sedes, módulos, auditoría y configuración.
- Catálogo inicial de módulos habilitados.
- Vista de Inventarios con catálogo, mínimos y movimientos de datos semilla.
- Documentación de producto, desarrollo, despliegue y seguimiento.

## Fuera de alcance en esta versión

- Base de datos, API, repositorios o procesos transaccionales.
- Inicio de sesión nativo, recuperación de contraseña o gestión persistente de usuarios.
- Autorización aplicada por permisos dentro de la aplicación.
- CRUD de productos, entradas, salidas, ajustes o reportes descargables.
- Compras, proveedores, equipos, proyectos, contratos, talento humano, APU, documentos y reportes.
- Integraciones externas, notificaciones, respaldo, monitoreo o auditoría operativa.

## Criterios de éxito de la siguiente entrega funcional

La siguiente entrega de Inventarios será considerada funcional cuando permita a un usuario autorizado crear productos, registrar un movimiento, recalcular existencias y dejar un registro auditable, todo con datos persistentes y validaciones de negocio.

## Principios de producto

1. **Una fuente de verdad.** Cada dato tiene un módulo dueño y un lugar confiable donde se mantiene.
2. **Progresión segura.** Una maqueta no se presenta como proceso listo para operación.
3. **Simplicidad operativa.** Las pantallas deben ayudar a decidir y actuar, no sólo mostrar datos.
4. **Trazabilidad.** Las operaciones relevantes deberán identificar quién, cuándo y por qué se realizaron.
5. **Crecimiento controlado.** Se incorpora un módulo cuando sus límites, permisos y datos están definidos.

