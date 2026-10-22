-- Eleva el statement_timeout por defecto para las consultas autenticadas.
-- Esto evita "canceling statement due to statement timeout" en pantallas que
-- cargan muchos registros (inventario, conteo físico, etc.).
alter role authenticated set statement_timeout = '120s';