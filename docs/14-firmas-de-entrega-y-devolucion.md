---
estado: operativo-inicial
ultima_actualizacion: 2026-10-20
---

## Alquiler rápido

Al confirmar una entrega rápida se abre primero un modal de firma. Un solo documento puede incluir varios equipos y una sola firma cubre toda la entrega. Solo después de que el cliente firme y se confirme el modal se registra el alquiler. La firma se guarda como adjunto `signature` en el bucket privado `rental-attachments` y se enlaza a `quick_rental_order_attachments`; el flujo activo no conserva la entrega ni la firma en `localStorage`. Si la firma no se puede subir después de crear la cabecera y las líneas, la entrega queda registrada y la pantalla muestra el aviso; no se crea un registro local paralelo ni se oculta el fallo.

# Firmas de entrega y devolución

Las salidas de material a obra, las devoluciones de material y los préstamos de herramienta requieren una firma manuscrita antes de confirmarse. La persona receptora o quien devuelve firma con el dedo en móvil o con mouse en computador.

La captura queda asociada al movimiento o préstamo junto con responsable, fecha y comprobante. El siguiente paso de persistencia empresarial es almacenar la evidencia de cada firma en Supabase Storage para todos los flujos, siguiendo el patrón ya disponible en alquileres rápidos.
