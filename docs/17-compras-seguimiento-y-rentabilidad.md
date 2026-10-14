# Compras desde faltantes, seguimiento comercial y rentabilidad

**Fecha:** 2026-10-14  
**Estado:** en implementacion

## Acuerdo funcional

Se desarrollan tres capacidades separadas de las mejoras de expediente, comparador de revisiones e indicadores comerciales:

1. **Compras desde faltantes.** Una requisicion con materiales sin cobertura podra convertirse en una orden de compra. La orden conserva el proyecto y la requisicion de origen, permite seleccionar proveedor por linea y, al recibirse, registra la entrada de inventario con su costo real. El despacho hacia obra sigue usando el flujo de requisiciones existente.
2. **Seguimiento comercial.** Cada cotizacion tendra una bitacora de contactos y compromisos, con responsable, fecha programada, resultado y proxima accion. La proxima accion resumida se mantiene visible en el tablero.
3. **Rentabilidad previa al envio.** Antes de enviar una propuesta se mostrara un control de costo, valor de venta, utilidad y margen. Los margenes bajos se advierten, pero no se oculta ni se altera el pre-costeo existente.

## Limites y responsabilidades

- Esta entrega no modifica expediente comercial, comparador de revisiones ni indicadores; esos elementos se implementan en componentes y migraciones independientes.
- El modulo de compras solo crea ordenes a partir de requisiciones y recibe inventario. No reemplaza la aprobacion o el despacho de almacen vigente.
- Las operaciones sensibles se ejecutan mediante funciones SQL con autorizacion por empresa; las tablas se protegen con RLS.

## Criterios de terminacion

- Orden de compra trazable a requisicion/proyecto y con recepcion parcial o total.
- Bitacora comercial persistente y proxima accion actualizable.
- Semaforo de margen y confirmacion explicita antes de marcar la cotizacion como enviada.
