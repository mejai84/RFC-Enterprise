-- Repair historical catalog text that was inserted with double UTF-8 encoding.
update public.apu_labor_positions
set name = convert_from(convert_to(name, 'LATIN1'), 'UTF8'),
    specialty_label = convert_from(convert_to(specialty_label, 'LATIN1'), 'UTF8'),
    source_document = convert_from(convert_to(source_document, 'LATIN1'), 'UTF8'),
    summary = convert_from(convert_to(summary, 'LATIN1'), 'UTF8')
where name like '%' || chr(195) || chr(131) || '%'
   or specialty_label like '%' || chr(195) || chr(131) || '%'
   or source_document like '%' || chr(195) || chr(131) || '%'
   or summary like '%' || chr(195) || chr(131) || '%';

update public.labor_rate_roles
set name = convert_from(convert_to(name, 'LATIN1'), 'UTF8'),
    specialty_label = convert_from(convert_to(specialty_label, 'LATIN1'), 'UTF8'),
    summary = convert_from(convert_to(summary, 'LATIN1'), 'UTF8')
where name like '%' || chr(195) || chr(131) || '%'
   or specialty_label like '%' || chr(195) || chr(131) || '%'
   or summary like '%' || chr(195) || chr(131) || '%';
