---
estado: vigente
ultima_actualizacion: 2026-10-05
audiencia: AdministraciÃ³n, AlmacÃ©n y Contabilidad
---

# Carga inicial, ubicaciÃ³n y valoraciÃ³n del inventario

## PropÃ³sito

La carga inicial establece el inventario real de partida sin obligar a inventar precios de materiales antiguos. Cada artÃ­culo se abre en una ficha para registrar la cantidad fÃ­sica, su ubicaciÃ³n actual y, cuando se conoce, su costo unitario.

## Flujo operativo

1. En **Conteos fÃ­sicos / Carga inicial**, buscar y seleccionar el artÃ­culo por nombre o SKU.
2. En la ficha, verificar los datos del artÃ­culo y registrar cantidad, bodega/estante/nivel actual y costo si existe soporte confiable.
3. Si se desconoce el costo histÃ³rico, se deja vacÃ­o.
4. Al aprobar la carga, se actualizan existencias y ubicaciones. Los artÃ­culos sin costo quedan en estado **Pendiente de valorar**.

## Primer valor y compras posteriores

- El primer valor de una existencia pendiente se registra una Ãºnica vez, con la fuente (factura, avalÃºo o lista de proveedor), fecha y responsable autorizado.
- Una compra posterior no aplica silenciosamente su precio a material antiguo pendiente: primero debe definirse su primer valor.
- Para una existencia ya valorada, cada entrada de compra recalcula el costo promedio ponderado.
- Las salidas y ajustes modifican cantidad, no el costo promedio.

## Criterio de control

No se utiliza un costo ficticio. Los valores pendientes deben revisarse antes de usar los informes financieros para decisiones contables.
