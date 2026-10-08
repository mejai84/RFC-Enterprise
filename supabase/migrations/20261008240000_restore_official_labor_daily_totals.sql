-- The official documents provide a Total dia per level. It must not be
-- overwritten by derived provisions or overtime calculations.
with official_totals (client_name, activity_type, version, code, total_daily_rate) as (
  values
    ('OCENSA', 'propias', '2026-2027', 'N1', 191387::numeric),
    ('OCENSA', 'propias', '2026-2027', 'N2', 219528::numeric),
    ('OCENSA', 'propias', '2026-2027', 'N3', 230989::numeric),
    ('OCENSA', 'propias', '2026-2027', 'N4', 269739::numeric),
    ('OCENSA', 'propias', '2026-2027', 'N5', 294260::numeric),
    ('OCENSA', 'propias', '2026-2027', 'N6', 327843::numeric),
    ('OCENSA', 'no_propias', '2026', 'N1', 94542::numeric),
    ('OCENSA', 'no_propias', '2026', 'N2', 98711::numeric),
    ('OCENSA', 'no_propias', '2026', 'N3', 111061::numeric),
    ('OCENSA', 'no_propias', '2026', 'N4', 113885::numeric),
    ('OCENSA', 'no_propias', '2026', 'N5', 146851::numeric),
    ('CENIT', 'general', '2026', 'N1', 216831::numeric),
    ('CENIT', 'general', '2026', 'N2', 231787::numeric),
    ('CENIT', 'general', '2026', 'N3', 248533::numeric),
    ('CENIT', 'general', '2026', 'N4', 275117::numeric),
    ('CENIT', 'general', '2026', 'N5', 301585::numeric),
    ('ODC', 'general', '2025', 'N1', 149769::numeric),
    ('ODC', 'general', '2025', 'N2', 159776::numeric),
    ('ODC', 'general', '2025', 'N3', 160836::numeric),
    ('ODC', 'general', '2025', 'N4', 187887::numeric),
    ('ODC', 'general', '2025', 'N5', 206520::numeric)
)
update public.labor_rate_entries e
set total_daily_rate = v.total_daily_rate,
    updated_at = now()
from public.labor_rate_tables t
join official_totals v on v.client_name = t.client_name and v.activity_type = t.activity_type and v.version = t.version
where e.labor_rate_table_id = t.id and e.code = v.code;
