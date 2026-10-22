---
titulo: Registro de ajustes de interfaz
audiencia: Producto, Desarrollo y Operación
ultima_actualizacion: 2026-10-19
---

# Registro de ajustes de interfaz

## 2026-10-14 — Navegación y tablero comercial

- La barra lateral plegada no debe dejar rótulos ni controles por fuera de su ancho.
- El Kanban de cotizaciones conserva sus etapas en pantallas angostas mediante desplazamiento horizontal visible y columnas compactas.

## 2026-10-14 — Contenido audiovisual de la portada

- La portada debe reproducir en móvil los mismos contenidos audiovisuales usados en escritorio.
- El video de campo e instalaciones no se sustituye por una imagen fija en móvil; se reproduce sin sonido, dentro de la página y respetando la preferencia de movimiento reducido.
## 2026-10-14 — Aviso de alertas operativas

- La campana del encabezado muestra un contador y se ilumina con un pulso breve mientras existan alertas operativas.
- La señal se desactiva cuando no hay alertas y no se anima si el usuario solicita reducir movimiento.


## 2026-10-14 — Planeación de cuadrilla en APU

- La explicación de rendimiento y duración física se muestra dentro del bloque de Planeación de cuadrilla, junto a los campos que intervienen en el cálculo.
- La barra inferior del APU queda reservada para guardar, imprimir, exportar, importar y eliminar.


## 2026-10-14 — Faltantes del APU bajo demanda

- El panel de faltantes y el botón Generar requisición solo se muestran cuando el APU tiene materiales o equipos que no cubre Inventarios.


## 2026-10-14 — Color de Planeación de cuadrilla

- Planeación de cuadrilla usa la paleta azul informativa del APU; no debe verse como una advertencia.


## 2026-10-19 — Alertas operativas en todos los módulos

- La campana del encabezado deja de depender de que la pantalla Resumen esté montada: carga sus alertas desde el shell compartido y las conserva al navegar por Cotizaciones, APU, Obras, Inventario y los demás módulos.
- Al abrir la campana se muestra el panel con el detalle de cada alerta y un enlace directo al caso que requiere atención. Cada usuario ve solo las alertas cuyo módulo destino está autorizado para su rol.
- Mientras carga muestra “Actualizando alertas…”; si la consulta falla muestra un error explícito y nunca un cero engañoso. Se actualiza al cambiar de ruta, al recuperar el foco y cuando cambia el conjunto de alertas del Resumen.

## 2026-10-19 — Ayudas del Resumen del dashboard

- Cada campo del Resumen (los cuatro indicadores financieros y las tarjetas de Cotizaciones, APU y Obras) lleva un icono “?” con la explicación de qué mide y de dónde sale el valor.
- El presupuesto de obras aclara que suma todas las obras registradas, no solo las activas; el gasto real aclara que son salidas de kardex menos devoluciones; el saldo advierte que puede ser negativo.
- Los contadores comerciales explican los estados que incluyen: cotizaciones en costeo, por revisar, sin APU, APU vinculados, frentes activos y cotizaciones confirmadas con su valor estimado.
- Se conserva el patrón visual y de teclado del componente de ayuda usado en Cotizaciones, Configuración y Mano de obra; el popover se abre con hover, foco o toque y no hereda las mayúsculas de las tarjetas.

## 2026-10-22 — Catálogo de actividades APU colapsable

- El bloque superior de catálogo de actividades prediseñadas del APU (`ApuActivityCatalog`) ahora es colapsable para evitar la sobrecarga visual y despejar el espacio de trabajo del analista de costos.
- En estado colapsado muestra una barra compacta con el título, badge de actividades disponibles (73) y botón interactivo `Explorar catálogo (73) ▼`.
- En estado expandido muestra el buscador predictivo, los chips de categoría y la grilla de actividades con el botón `Ocultar catálogo ▲`.
- La preferencia de visualización (abierto/cerrado) se almacena en `localStorage` (`rfc_apu_catalog_collapsed`) para respetar la elección del usuario entre sesiones.
- Se habilitan controles de accesibilidad completos con soporte de teclado (Enter / Espacio) y atributos `aria-expanded` y `aria-controls`.

