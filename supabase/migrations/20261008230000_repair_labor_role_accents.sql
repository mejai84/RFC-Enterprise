-- Repairs historical double-UTF8 text in every labor job label.
update public.apu_labor_positions
set name = convert_from(convert_to(name, 'LATIN1'), 'UTF8'),
    specialty_label = convert_from(convert_to(specialty_label, 'LATIN1'), 'UTF8'),
    source_document = convert_from(convert_to(source_document, 'LATIN1'), 'UTF8'),
    summary = convert_from(convert_to(summary, 'LATIN1'), 'UTF8')
where position(chr(195) in name) > 0
   or position(chr(195) in specialty_label) > 0
   or position(chr(195) in source_document) > 0
   or position(chr(195) in summary) > 0;

update public.labor_rate_roles
set name = convert_from(convert_to(name, 'LATIN1'), 'UTF8'),
    specialty_label = convert_from(convert_to(specialty_label, 'LATIN1'), 'UTF8'),
    summary = convert_from(convert_to(summary, 'LATIN1'), 'UTF8')
where position(chr(195) in name) > 0
   or position(chr(195) in specialty_label) > 0
   or position(chr(195) in summary) > 0;
