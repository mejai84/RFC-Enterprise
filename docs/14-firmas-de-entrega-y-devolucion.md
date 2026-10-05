---
estado: operativo-inicial
ultima_actualizacion: 2026-10-05
---

## Alquiler rápido

Al confirmar una entrega rápida se abre primero un modal de firma. Solo después de que el cliente firme y se confirme el modal se registra el alquiler y se bloquea el equipo. La firma se guarda como adjunto `signature` en Supabase Storage; sin conexión se conserva junto al alquiler local.

# Firmas de entrega y devolución

Las salidas de material a obra, las devoluciones de material y los préstamos de herramienta requieren una firma manuscrita antes de confirmarse. La persona receptora o quien devuelve firma con el dedo en móvil o con mouse en computador.

La captura queda asociada al movimiento o préstamo junto con responsable, fecha y comprobante. El siguiente paso de persistencia empresarial es almacenar la evidencia de cada firma en Supabase Storage para todos los flujos, siguiendo el patrón ya disponible en alquileres rápidos.
