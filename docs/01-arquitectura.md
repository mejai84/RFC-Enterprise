---
estado: vigente
propietario: Desarrollo RFC Enterprise
ultima_actualizacion: 2026-09-15
audiencia: Desarrollo y Operación
---

# Arquitectura de RFC Enterprise

## Decisión arquitectónica

RFC Enterprise es un **monolito modular** construido con Next.js, React y TypeScript. Una sola aplicación se despliega y opera como unidad, pero cada dominio de negocio conserva límites claros para que pueda evolucionar sin acoplarse con los demás.

```text
src/
├── app/                  Rutas, layouts y composición de interfaz
├── core/                 Capacidades transversales del ERP
├── modules/              Dominios de negocio independientes
└── shared/               Tipos y utilidades realmente genéricas
```

## Reglas de dependencia

```text
shared  ← no depende de Core ni de módulos
core    ← puede usar shared; no importa módulos de negocio
modules ← pueden usar core y shared; no importan detalles de otros módulos
app     ← compone interfaces y consume contratos públicos
```

Una página no debe contener reglas de negocio, consultas a datos ni autorización. Cada módulo expone únicamente su contrato público mediante su `index.ts`.

## Componentes actuales

| Área | Ubicación | Responsabilidad actual |
| --- | --- | --- |
| Sitio y rutas | `src/app` | Sitio institucional, acceso demostrativo, dashboard e Inventarios |
| Core | `src/core` | Contratos iniciales de auth, users, roles, permissions, companies, branches, modules, audit y settings |
| Inventarios | `src/modules/inventory` | Tipos de producto y movimiento, datos semilla y contrato público |
| Compartido | `src/shared` | Identificadores y tipos transversales |
| Activos | `public` | Logo RFC e imágenes de interfaz |

## Rutas y madurez

| Ruta | Dueño | Madurez | Nota |
| --- | --- | --- | --- |
| `/` | Sitio institucional | Disponible | Contenido corporativo |
| `/login` | Core / UI | Maqueta | No valida identidad ni crea sesión |
| `/dashboard` | Core / UI | Demostrativo | Indicadores estáticos |
| `/inventory` | Inventarios | Demostrativo | Lee fixtures locales, no guarda cambios |

Las opciones visibles de Movimientos, Reportes y Configuración todavía no representan módulos ni rutas independientes. No deben presentarse como funcionalidades entregadas.

## Datos y estado actual

Los datos iniciales viven en código como fixtures. Inventarios puede simular entradas, salidas y ajustes durante la sesión activa de la pantalla, pero esos cambios se pierden al recargar. No existen base de datos, API, migraciones, repositorios, colas ni eventos. El modelo de usuarios y roles es una referencia de arquitectura; no se aplica como control de acceso dentro de las pantallas.

En consecuencia, ningún dato visible debe considerarse registro operativo, histórico o fuente contable.

## Preparación para la siguiente etapa

Antes de implementar acciones reales, el equipo debe acordar y documentar:

1. proveedor de base de datos y estrategia de migraciones;
2. autenticación, sesión, restablecimiento de acceso y ciclo de vida de usuarios;
3. mecanismo de autorización por permisos;
4. contrato de auditoría transversal;
5. estándares de identificadores, fechas, zona horaria, empresa y sede;
6. estrategia de respaldo, recuperación y monitoreo.

## Restricción de publicación actual

El proyecto utiliza exportación estática. Esta elección permite la versión visual actual, pero no cubre por sí misma API segura, sesiones de aplicación ni persistencia. Cuando se active operación transaccional, debe revisarse la arquitectura de hosting y backend antes de declarar el ERP apto para producción.
