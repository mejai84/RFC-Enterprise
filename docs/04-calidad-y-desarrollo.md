---
estado: vigente
propietario: Desarrollo RFC Enterprise
ultima_actualizacion: 2026-09-15
audiencia: Desarrollo y QA
---

# Calidad y desarrollo

## Entorno local

Use una versión LTS de Node.js compatible con la versión instalada de Next.js. Antes de una liberación formal se debe declarar la versión exacta de Node en el repositorio y en la automatización.

```bash
npm install
npm run dev
```

## Verificación mínima por cambio

```bash
npm run lint
npx tsc --noEmit
npm run build
```

La verificación de tipos debe ejecutarse de forma independiente. En la configuración actual, la construcción tolera errores de TypeScript como medida temporal del entorno de exportación; esta excepción deberá eliminarse antes de la primera operación productiva.

## Matriz de pruebas actual

| Tipo | Estado | Acción requerida |
| --- | --- | --- |
| Lint | Disponible | Ejecutar en cada cambio |
| Tipos | Disponible manualmente | Ejecutar en cada cambio |
| Build | Disponible | Ejecutar antes de publicar |
| Pruebas unitarias | Pendiente | Añadir al crear casos de uso |
| Pruebas de integración | Pendiente | Añadir con API y persistencia |
| Pruebas de interfaz | Pendiente | Añadir para rutas y flujos críticos |
| CI | Pendiente | Configurar en GitHub antes de producción |

## Checklist de revisión técnica

- El cambio respeta los límites de Core, Shared, módulos y rutas.
- Los tipos son explícitos y no se usan datos de demostración como fuente operativa.
- Todo endpoint, caso de uso o acción futura valida autorización.
- Los textos y estados vacíos son claros para usuarios no técnicos.
- La interfaz funciona en pantalla de escritorio y móvil.
- Se actualizaron documentación, changelog y backlog cuando corresponde.
- No existen secretos, PII innecesaria, archivos de build ni dependencias sin justificar.

## Estrategia de ramas y entregas

Una vez GitHub sea el repositorio canónico, se adopta este modelo:

| Rama | Uso | Regla |
| --- | --- | --- |
| `main` | Código aprobado y desplegable | Protegida; cambios mediante revisión |
| `feature/*` | Funcionalidad nueva | Una tarea de backlog por rama |
| `fix/*` | Corrección puntual | Prueba de regresión obligatoria |
| `docs/*` | Documentación | Revisión del responsable de área |

Cada solicitud de cambio debe incluir: enlace a la tarea, resumen, alcance excluido, evidencia de verificación, impacto en datos/permisos, riesgo y plan de reversión si corresponde.

## Criterios de aceptación de interfaz

Para componentes visuales:

1. el contenido representa datos reales o se rotula explícitamente como demostrativo;
2. acciones no implementadas no simulan guardar, aprobar o modificar datos;
3. se incluyen estados de carga, vacío, error y éxito cuando el flujo sea real;
4. los permisos visibles coinciden con los permisos aplicados;
5. la experiencia conserva la identidad de RFC Enterprise sin reutilizar marcas de referencias externas.

