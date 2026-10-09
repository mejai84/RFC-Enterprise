-- Completa el catalogo oficial de OCENSA con los cargos que faltaban.
--
-- La base tenia 68 de los 144 cargos que publica el documento
-- AEX-INS-006 version 26. Estos 66 completan la lista.
--
-- Son cargos nuevos: no modifican ningun valor, ninguna tabla de la
-- empresa ni ninguna cotizacion ya hecha.
--
-- El documento viene en dos paginas de las que no se extrae texto, asi
-- que la lista se transcribio a mano y conviene validarla con el cliente
-- antes de usarla para comprometer un precio. La especialidad de cada
-- cargo se dedujo del nombre y quedo marcada para confirmar.
--
-- Cada cargo nace con la dotacion de su nivel, igual que los que ya
-- estaban, para que ninguno quede en cero.

with official_roles (code, name, scale, specialty, specialty_label, level, summary) as (
  values
    ('PROP-OFI-N1-04', 'Oficinista 2', 'propias', 'servicios_apoyo', 'Servicios de apoyo', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AUX-N1-07', 'Auxiliar Servicios Generales', 'propias', 'obra_civil', 'Obra civil', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-APU-N1-08', 'Apunta Tiempo', 'propias', 'obra_civil', 'Por definir', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-MOT-N1-09', 'Motosierrista', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N1-10', 'Operador Motobomba', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-HID-N1-11', 'Hidro Lavadora y Electrobomba', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N1-12', 'Operador de Rana; Martillo; Chapola', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AYU-N2-03', 'Ayudante Mecánico Off Shore', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-MAR-N2-06', 'Marinero Operador', 'propias', 'maritimo', 'Marítimo', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-CAM-N2-07', 'Camarero', 'propias', 'maritimo', 'Marítimo', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-MAR-N2-08', 'Marinero AB de Embarcación', 'propias', 'maritimo', 'Marítimo', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-MAR-N2-09', 'Marinero Ajustador de Bridas', 'propias', 'maritimo', 'Marítimo', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AYU-N2-10', 'Ayudante de Mecánica', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AYU-N2-13', 'Ayudante Cadenero', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-SOC-N2-17', 'Socorrista', 'propias', 'obra_civil', 'Obra civil', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-CON-N2-18', 'Conductor de Ambulancia', 'propias', 'obra_civil', 'Por definir', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-CAM-N2-19', 'Campamentero', 'propias', 'obra_civil', 'Obra civil', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AYU-N2-20', 'Ayudante Torque', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-TOL-N2-21', 'Tolvero', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-POR-N2-22', 'Portaprisma', 'propias', 'obra_civil', 'Por definir', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-MEC-N3-02', 'Mecánico Off Shore', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-MAR-N3-03', 'Marinero Timonel', 'propias', 'maritimo', 'Marítimo', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-MAR-N3-04', 'Marinero de Máquinas', 'propias', 'maritimo', 'Marítimo', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-MAR-N3-05', 'Marinero Cocinero (Embarcaciones Mayores)', 'propias', 'maritimo', 'Marítimo', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OFI-N3-06', 'Oficial I', 'propias', 'obra_civil', 'Obra civil', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OFI-N3-09', 'Oficinista 1', 'propias', 'servicios_apoyo', 'Servicios de apoyo', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AUX-N3-13', 'Auxiliar Materiales', 'propias', 'obra_civil', 'Obra civil', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AUX-N3-15', 'Auxiliar de Enfermería', 'propias', 'obra_civil', 'Obra civil', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N3-18', 'Operador de Motoniveladora', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-RET-N3-19', 'Retroexcavadora', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-VIB-N3-20', 'Vibrocompactador', 'propias', 'obra_civil', 'Por definir', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AUX-N3-21', 'Auxiliar Ambiental', 'propias', 'obra_civil', 'Obra civil', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-ANA-N3-22', 'Analista de Gestión de Mantenimiento', 'propias', 'obra_civil', 'Por definir', 3, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-CAD-N4-08', 'Cadenero 1', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-DOC-N4-09', 'Documentador', 'propias', 'servicios_apoyo', 'Servicios de apoyo', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-11', 'Operador Equipo Pesado 1', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-14', 'Operador de Retroexcavadora', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-15', 'Operador Bobcat', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-16', 'Operador Man Lift', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-19', 'Operador Camabaja/Alta', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-ELE-N4-20', 'Electromecánico', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-21', 'Operador Camión Grúa', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-22', 'Operador Planta de Concreto', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-AUX-N4-25', 'Auxiliar Ambiental', 'propias', 'obra_civil', 'Obra civil', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-27', 'Operador Montacargas', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-28', 'Operador Cargador', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-29', 'Operador Retrollantas', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N4-30', 'Operador Carromacho', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-DOB-N4-32', 'Doblador', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-CON-N5-03', 'Contramaestre AB Embarcación', 'propias', 'maritimo', 'Marítimo', 5, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N5-12', 'Operador de Equipo Pesado 1A', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 5, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-LAB-N5-14', 'Laboratorista', 'propias', 'obra_civil', 'Por definir', 5, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-OPE-N6-03', 'Operador de Grúa mayor a 80 Ton', 'propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 6, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('PROP-ENF-N6-04', 'Enfermera Profesional', 'propias', 'obra_civil', 'Por definir', 6, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-OBR-N1-02', 'Obrero Descontaminación', 'no_propias', 'obra_civil', 'Por definir', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-CAM-N1-03', 'Camarera', 'no_propias', 'obra_civil', 'Por definir', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-AUX-N1-04', 'Auxiliar de Aseo y Cafetería', 'no_propias', 'obra_civil', 'Obra civil', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-MES-N1-05', 'Mesero', 'no_propias', 'obra_civil', 'Por definir', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-AYU-N1-06', 'Ayudante MTTO Vehículos', 'no_propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-MEN-N1-10', 'Mensajero', 'no_propias', 'obra_civil', 'Por definir', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-REC-N1-11', 'Recepcionista', 'no_propias', 'obra_civil', 'Por definir', 1, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-AUX-N2-04', 'Auxiliar de Inventarios', 'no_propias', 'obra_civil', 'Obra civil', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-TEC-N2-06', 'Técnico Gestión Documental / Auxiliar', 'no_propias', 'servicios_apoyo', 'Servicios de apoyo', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-APA-N2-10', 'Aparejador de Equipos de Izaje', 'no_propias', 'obra_civil', 'Por definir', 2, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-AYU-N4-04', 'Ayudante Eléctrico', 'no_propias', 'electricidad_e_instrumentacion', 'Electricidad e instrumentación', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.'),
    ('NOPROP-AYU-N4-05', 'Ayudante Mecánico', 'no_propias', 'maquinaria_y_equipos', 'Maquinaria y equipos', 4, 'Cargo oficial de la tabla AEX-INS-006 v26. Especialidad deducida del nombre, por confirmar con el cliente.')
)
insert into public.labor_rate_roles
  (company_id, labor_rate_table_id, labor_rate_entry_id, code, name, specialty, specialty_label,
   scale, summary, receives_hotel, receives_operational_transport, is_active)
select t.company_id,
       t.id,
       e.id,
       v.code,
       v.name,
       v.specialty,
       v.specialty_label,
       v.scale,
       v.summary,
       v.name ~* 'capataz|conductor',
       v.name ~* 'capataz|conductor',
       true
  from official_roles v
  join public.labor_rate_tables t
    on t.name = 'OCENSA - tabla salarial 2026-2027'
  join public.labor_rate_entries e
    on e.labor_rate_table_id = t.id
   and e.scale = v.scale
   and e.level = v.level
on conflict (labor_rate_table_id, code) do nothing;

/* "Operador Retroexcavadora Manlift Bobcat" venia como un solo cargo,
   pero son tres maquinas distintas que en obra se manejan por separado.
   Se apaga el agrupado y se crean las tres. */
do $$
declare
  v_tabla uuid;
  v_nivel4 uuid;
  v_agrupado uuid;
begin
  select id into v_tabla from public.labor_rate_tables
   where name = 'OCENSA - tabla salarial 2026-2027' limit 1;
  select id into v_nivel4 from public.labor_rate_entries
   where labor_rate_table_id = v_tabla and level = 4 and scale = 'propias' limit 1;

  select id into v_agrupado from public.labor_rate_roles
   where labor_rate_table_id = v_tabla and is_active
     and lower(name) like '%retroexcavadora%'
     and lower(name) like '%bobcat%'
   limit 1;

  if v_agrupado is not null then
    update public.labor_rate_roles
       set is_active = false,
           summary = 'Agrupaba tres maquinas. Quedan separados en tres cargos.'
     where id = v_agrupado;

    insert into public.labor_rate_roles
      (company_id, labor_rate_table_id, labor_rate_entry_id, code, name, specialty,
       specialty_label, scale, summary, is_active)
    select t.company_id, v_tabla, v_nivel4,
           'PROP-OPER-N4-S' || substr(md5(s.cargo), 1, 4),
           s.cargo, 'maquinaria_y_equipos', 'Maquinaria y equipos', 'propias',
           'Cargo oficial de la tabla AEX-INS-006 v26, separado del grupo que lo agrupaba.', true
      from (values
        ('Operador de Retroexcavadora'),
        ('Operador Bobcat'),
        ('Operador Man Lift')
      ) as s(cargo)
      cross join public.labor_rate_tables t
     where t.id = v_tabla
    on conflict (labor_rate_table_id, code) do nothing;
  end if;
end;
$$;

/* La dotacion se hereda del nivel, igual que los cargos que ya estaban. */
insert into public.labor_role_dotacion
  (company_id, labor_rate_role_id, concept_id, quantity, unit_value_override, inherited_from_level)
select r.company_id, r.id, cat.id, i.quantity, null, true
  from public.labor_rate_roles r
  join public.labor_rate_entries e on e.id = r.labor_rate_entry_id
  join public.labor_dotacion_items i
    on i.labor_rate_table_id = e.labor_rate_table_id and i.profile = e.level
  join public.labor_dotacion_concepts cat
    on cat.company_id = r.company_id and lower(cat.source_name) = lower(i.concept)
  join public.labor_rate_tables t on t.id = r.labor_rate_table_id
 where t.name = 'OCENSA - tabla salarial 2026-2027' and r.is_active
on conflict (labor_rate_role_id, concept_id) do nothing;

select private.recompute_role_dotacion();
select private.recompute_role_computed_cost();
