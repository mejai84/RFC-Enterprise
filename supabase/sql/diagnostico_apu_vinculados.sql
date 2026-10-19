-- Diagnóstico: por qué el dashboard muestra "0 APUs vinculados a cotizaciones".
-- No requiere reemplazar ningún valor: todas las consultas descubren los datos solas.
-- Ejecutar en el SQL Editor del proyecto con el rol de servicio (o uno que pueda leer estas tablas).

-- 1) Panorama por empresa. "vinculados" cuenta filas con quote_id; "generales" con quote_id nulo.
select
  a.company_id,
  count(*)                                       as total,
  count(*) filter (where a.quote_id is not null) as vinculados,
  count(*) filter (where a.quote_id is null)     as generales,
  count(*) filter (where a.status = 'archived')  as archivados
from public.apu_analyses a
group by a.company_id
order by total desc;

-- 2) Todas las filas, para ver el patrón real de vínculo.
select id, company_id, code, name, quote_id, quote_code, status, created_at
from public.apu_analyses
order by created_at desc;

-- 3) La cotización y su id real (para compararlo con apu_analyses.quote_id).
select id, code, title, status
from public.quotes
where code = 'COT-001-2026-OCENSA-PREFABRICADO_E_INSTALA';

-- 4) Los análisis que dicen pertenecer a esa cotización (por id o por código).
select id, code, name, quote_id, quote_code, status, created_at
from public.apu_analyses
where quote_id = (
        select id from public.quotes
        where code = 'COT-001-2026-OCENSA-PREFABRICADO_E_INSTALA'
      )
   or quote_code = 'COT-001-2026-OCENSA-PREFABRICADO_E_INSTALA'
order by created_at;

-- ---------------------------------------------------------------------------
-- Interpretación
-- ---------------------------------------------------------------------------
-- Si la consulta 4 devuelve 10 filas con quote_id LLENO:
--   los datos están bien; el dashboard que ves es un build viejo.
--   Recompila/reinicia el servidor (npm run dev, o npm run build + npm run start)
--   o vuelve a desplegar, y recarga con Ctrl+F5.
--
-- Si la consulta 4 devuelve 10 filas con quote_id NULO:
--   los APU se guardaron como catálogo general (ADR-096: entrar al módulo desde
--   el menú crea actividades generales). La cotización realmente no tiene APU
--   vinculado, y el dashboard tiene razón. Para reparar el vínculo, usa el
--   script de la sección siguiente.
--
-- ---------------------------------------------------------------------------
-- Reparación (solo si la consulta 4 mostró quote_id nulo)
-- ---------------------------------------------------------------------------
-- Revisa primero qué va a cambiar:
select a.id, a.code, a.quote_id, a.quote_code, q.id as quote_id_destino
from public.apu_analyses a
join public.quotes q
  on q.company_id = a.company_id
 and q.code = a.quote_code
where a.quote_id is null
  and a.quote_code is not null
  and a.status <> 'archived';

-- Y luego aplica el vínculo:
-- update public.apu_analyses a
-- set quote_id = q.id
-- from public.quotes q
-- where a.quote_id is null
--   and a.quote_code is not null
--   and a.status <> 'archived'
--   and q.company_id = a.company_id
--   and q.code = a.quote_code;
