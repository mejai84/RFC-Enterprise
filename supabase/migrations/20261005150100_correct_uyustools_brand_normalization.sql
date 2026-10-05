-- Corrige variantes Uyustools y el error de digitación ayustool.
update public.inventory_items
set brand = 'UYUSTOOLS'
where regexp_replace(lower(trim(brand)), '\s+n/a$', '') ~ '^(uyustool|ayustool)s?$';
