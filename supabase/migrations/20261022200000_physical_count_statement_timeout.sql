-- Aumenta el statement_timeout de las RPC de conteo físico.
-- Abrir y conciliar una jornada inserta/mueve una línea por cada artículo del
-- inventario; con catálogos grandes el default (8s) cancela la sentencia.
alter function public.open_physical_count(uuid, text, text, text, text)
  set statement_timeout = '300s';

alter function public.approve_physical_count(uuid)
  set statement_timeout = '300s';

alter function public.save_physical_count_line(uuid, uuid, numeric, text, numeric, text)
  set statement_timeout = '60s';

alter function public.add_physical_count_new_item(uuid, text, text, text, text, text, text, numeric, numeric, text)
  set statement_timeout = '60s';