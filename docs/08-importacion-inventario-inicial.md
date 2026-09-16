---
estado: vigente
propietario: Desarrollo RFC Enterprise
ultima_actualizacion: 2026-09-16
audiencia: Producto, Desarrollo y Operación
---

# Importación inicial de Inventarios

## Fuente

El catálogo inicial procede de `Inventario_Basico.xlsx`. El archivo original no se modifica y seguirá siendo la evidencia fuente durante la transición.

## Alcance cargado en la demostración

| Inventario | Artículos | Unidades disponibles | Movimientos históricos |
| --- | ---: | ---: | ---: |
| Bodega | 939 | 10.624 | 593 |
| Dotación | 154 | 1.732 | 131 |
| Herramientas de trabajadores | 98 | 139 | 98 |
| **Total** | **1.191** | **12.495** | **822** |

La pantalla actual utiliza el catálogo y el stock actual. Los movimientos históricos no se muestran todavía como operaciones del portal: se reservaron para una migración controlada a base de datos.

## Correspondencia de datos

| Excel | RFC Enterprise | Nota |
| --- | --- | --- |
| Clave de Producto | `sku` y nombre de artículo | La clave actual no es un identificador único global |
| Descripción del Producto | Categoría | Se conserva tal como viene en la fuente |
| Existencia Actual | Stock disponible | Es el saldo inicial de migración |
| Marca | Marca | Valor `N/A` se conserva como dato fuente |
| Ubicación | Ubicación | Se mantiene por artículo/lote de ubicación |
| Notas | Notas | Disponible para la futura BD |
| Cantidad Entrada / Salida | Movimiento | Se migrará como entrada o salida |
| Fecha Movimiento | Fecha de movimiento | Bodega tiene historial entre 2025-01-18 y 2026-03-27 |

## Decisiones para la futura base de datos

1. Se crearán tres almacenes o tipos de inventario: `bodega`, `dotacion` y `trabajadores`.
2. Un artículo podrá tener varios saldos por ubicación y marca. Esto evita unir registros que hoy comparten nombre pero están físicamente separados.
3. La clave original se conservará como referencia de migración, pero la base de datos tendrá identificadores propios.
4. Los mínimos no se migran porque el archivo no los define. Se configurarán después por artículo y ubicación.
5. Cada movimiento importado llevará fuente, fila original y fecha de importación para auditoría.
6. Los movimientos que no puedan relacionarse sin ambigüedad con un artículo/ubicación pasarán a una cola de revisión, nunca se asignarán automáticamente.

## Calidad a revisar antes de migrar

- Bodega contiene 7 claves repetidas y Dotación 1. Corresponden a existencias en ubicaciones o marcas distintas y deben mantenerse separadas.
- Hay categorías, marcas y ubicaciones incompletas en algunos artículos; se conservan como `Sin categoría`, `Sin marca` o `Sin ubicación` sólo en la demostración para no perder el registro.
- Los textos con caracteres dañados se normalizarán en una tabla de revisión, sin alterar el archivo fuente.

## Plan de migración

1. Crear tablas de almacenes, artículos, ubicaciones, saldos y movimientos.
2. Cargar el catálogo conservando grupo, marca, ubicación y referencia de fila.
3. Conciliar los 12.495 saldos importados contra la hoja original.
4. Cargar movimientos por fecha y validar que el saldo resultante coincida con cada artículo.
5. Resolver la cola de duplicados, campos incompletos y referencias no encontradas.
6. Aprobar la conciliación antes de habilitar movimientos reales en el portal.

