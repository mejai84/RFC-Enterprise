-- Consolidación de variantes obvias de marca importadas con diferencias de digitación.
update public.inventory_items
set brand = 'UYUSTOOLS'
where regexp_replace(lower(trim(brand)), '\s+n/a$', '') ~ '^a?yustools?$';
