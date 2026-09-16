# RFC Enterprise

Portal corporativo y base del ERP modular de Representaciones Figueroa Castro. El proyecto reúne un sitio institucional público y una aplicación interna que crecerá por módulos, sin convertir el código en varios proyectos independientes.

> Estado actual: **v0.1 — base visual y arquitectónica**. El dashboard e Inventarios usan datos de demostración; todavía no existe una base de datos, autenticación propia ni operaciones de inventario persistentes.

## Inicio rápido

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` para ver el sitio. Rutas disponibles:

| Ruta | Propósito | Estado |
| --- | --- | --- |
| `/` | Sitio institucional | Disponible |
| `/login` | Pantalla de acceso demostrativa | Maqueta |
| `/dashboard` | Resumen operativo | Demostrativo |
| `/inventory` | Módulo inicial de Inventarios | Demostrativo |

## Verificación antes de entregar

```bash
npm run lint
npx tsc --noEmit
npm run build
```

El chequeo explícito de TypeScript es obligatorio: la configuración de construcción actual tolera errores de tipos de forma temporal para el entorno de publicación estática. Consulte el plan para retirar esta excepción en la documentación de calidad.

## Documentación del proyecto

La documentación se mantiene junto al código para que cualquier persona de producto, desarrollo u operación pueda continuar el trabajo:

- [Índice de documentación](docs/README.md)
- [Visión y alcance](docs/00-vision-y-alcance.md)
- [Arquitectura](docs/01-arquitectura.md)
- [Módulos y roadmap](docs/02-modulos-y-roadmap.md)
- [Seguimiento del proyecto](docs/03-seguimiento-del-proyecto.md)
- [Calidad y forma de trabajo](docs/04-calidad-y-desarrollo.md)
- [Seguridad, accesos y despliegue](docs/05-seguridad-accesos-y-despliegue.md)
- [Backlog y riesgos](docs/06-backlog-y-riesgos.md)
- [Registro de decisiones](docs/07-registro-de-decisiones.md)

Las reglas técnicas que deben seguir los agentes y el equipo están en [AGENTS.md](AGENTS.md). Las pautas para colaborar están en [CONTRIBUTING.md](CONTRIBUTING.md).

## Tecnología

- Next.js con App Router
- React y TypeScript
- CSS propio para la interfaz actual
- Exportación estática para el hosting configurado

## Repositorio y publicación

El repositorio de referencia es [RFC-Enterprise](https://github.com/mejai84/RFC-Enterprise). No se deben registrar contraseñas, tokens, claves ni datos personales en el código, la documentación o los commits.

