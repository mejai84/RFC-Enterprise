---
estado: vigente
ultima_actualizacion: 2026-10-05
audiencia: Administración, Almacén y Contabilidad
---

# Carga inicial, ubicación y valoración del inventario

## Propósito

La carga inicial establece el inventario real de partida sin obligar a inventar precios de materiales antiguos. Cada artículo se abre en una ficha para registrar la cantidad física, su ubicación actual y, cuando se conoce, su costo unitario.

## Flujo operativo

1. En **Conteos físicos / Carga inicial**, buscar y seleccionar el artículo por nombre o SKU.
2. En la ficha, verificar los datos del artículo y registrar cantidad, bodega/estante/nivel actual y costo si existe soporte confiable.
3. Si se desconoce el costo histórico, se deja vacío.
4. Al aprobar la carga, se actualizan existencias y ubicaciones. Los artículos sin costo quedan en estado **Pendiente de valorar**.

## Primer valor y compras posteriores

- El primer valor de una existencia pendiente se registra una única vez, con la fuente (factura, avalúo o lista de proveedor), fecha y responsable autorizado.
- Una compra posterior no aplica silenciosamente su precio a material antiguo pendiente: primero debe definirse su primer valor.
- Para una existencia ya valorada, cada entrada de compra recalcula el costo promedio ponderado.
- Las salidas y ajustes modifican cantidad, no el costo promedio.

## Criterio de control

No se utiliza un costo ficticio. Los valores pendientes deben revisarse antes de usar los informes financieros para decisiones contables.

## Jornadas periódicas de conteo físico

Después de la carga inicial, el mismo módulo abre una **Nueva jornada**. La persona responsable elige si contará toda la bodega, una ubicación o una categoría, registra las cantidades reales y finalmente selecciona **Cerrar y conciliar**. La conciliación genera ajustes de entrada o salida únicamente para las diferencias y conserva la jornada, el motivo, la fecha y el historial como evidencia auditable.

## Catálogos y normalización

- Las unidades de consumo se seleccionan con nombre y abreviatura: por ejemplo, **Kilogramo (kg)**, **Metro (m)**, **Galón (gal)** y **Onza (oz)**.
- Presentación y ubicación parten de un catálogo base y se complementan con los valores reales registrados.
- Marcas, modelos y referencias sugieren valores ya usados. La normalización une solamente variantes inequívocas; por ejemplo, `uyustools`, `Uyustools N/A` y el error `ayustool` se consolidan como **UYUSTOOLS**. Los nombres que incluyen una referencia de modelo se conservan para revisión, sin asumir que sean la misma marca.
- Si un valor no existe, el usuario lo escribe directamente en la ficha y lo guarda con el artículo. No se crean catálogos maestros vacíos: el dato nuevo queda disponible como sugerencia cuando ya existe una ficha real que lo respalda.
