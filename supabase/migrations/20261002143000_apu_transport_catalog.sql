-- ─────────────────────────────────────────────────────────────
-- Migración: Catálogo de Transporte y Fletes para APU
-- Estándares de gestión de flotas y costos de fletes
-- ─────────────────────────────────────────────────────────────

create table if not exists public.apu_transport_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('carga_pesada', 'volquetas', 'transporte_personal', 'vehiculos_livianos', 'fluvial_especial')),
  category_label text not null,
  unit text not null check (unit in ('viaje', 'día', 'mes', 'hora', 'km', 'gl')),
  default_rate numeric(14,2) not null check (default_rate >= 0),
  capacity text not null default '',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

-- Agregar referencias a líneas de versión de APU
alter table public.apu_version_lines
  add column if not exists transport_item_id uuid references public.apu_transport_items(id) on delete set null,
  add column if not exists transport_code text;

-- Índices de consulta y rendimiento
create index if not exists apu_transport_items_company_active_idx
  on public.apu_transport_items (company_id, is_active, name);

create index if not exists apu_transport_items_category_idx
  on public.apu_transport_items (company_id, category)
  where is_active;

-- Seguridad RLS
alter table public.apu_transport_items enable row level security;

create policy apu_transport_items_member_read
  on public.apu_transport_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_transport_items.company_id
    )
  );

create policy apu_transport_items_manager_insert
  on public.apu_transport_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_transport_items.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  );

create policy apu_transport_items_manager_update
  on public.apu_transport_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_transport_items.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_transport_items.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  );

create policy apu_transport_items_manager_delete
  on public.apu_transport_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_transport_items.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  );

-- Inserción inicial de semillas para todas las empresas existentes
insert into public.apu_transport_items (company_id, code, name, category, category_label, unit, default_rate, capacity, description)
select
  c.id,
  s.code,
  s.name,
  s.category,
  s.category_label,
  s.unit,
  s.default_rate,
  s.capacity,
  s.description
from public.companies c
cross join (
  values
    ('TR-CB-30T', 'Cama Baja (Lowboy) 30 Toneladas', 'carga_pesada', 'Carga pesada y maquinaria (Lowboy / Cama alta)', 'viaje', 2400000.00, 'Hasta 30 Toneladas', 'Movilización de retroexcavadoras de oruga, vibrocompactadores y motoniveladoras.'),
    ('TR-CB-50T', 'Cama Baja (Lowboy) 50 Toneladas / Cuello Desmontable', 'carga_pesada', 'Carga pesada y maquinaria (Lowboy / Cama alta)', 'viaje', 3600000.00, 'Hasta 50 Toneladas', 'Transporte de grúas telescópicas, tiendetubos (Sideboom) y módulos pesados.'),
    ('TR-CA-PLANCHON', 'Cama Alta / Planchón 3 Ejes (40 pies)', 'carga_pesada', 'Carga pesada y maquinaria (Lowboy / Cama alta)', 'viaje', 1850000.00, 'Hasta 32 Ton / 12 metros', 'Transporte de tubería de línea de 40 pies, perfiles estructurales, casetas y contenedores.'),
    ('TR-CG-5T', 'Camión Grúa con Brazo Hidráulico Articulado 5 Ton', 'carga_pesada', 'Carga pesada y maquinaria (Lowboy / Cama alta)', 'día', 1450000.00, 'Brazo 5 Ton / Carga 10 Ton', 'Autocargue, transporte y descargue de tubos, bombas y accesorios en frentes de línea.'),
    ('TR-VOLQ-SENC', 'Volqueta Sencilla 7 m³', 'volquetas', 'Volquetas y acarreo de materiales', 'día', 580000.00, '7 Metros Cúbicos', 'Transporte local y distribución de arena, triturado, escombros y afirmado.'),
    ('TR-VOLQ-DOBLE', 'Volqueta Dobletroque 15 m³', 'volquetas', 'Volquetas y acarreo de materiales', 'día', 980000.00, '15 Metros Cúbicos', 'Acarreo masivo de material de subbase, suelo de excavación y agregados.'),
    ('TR-BUS-28P', 'Buseta de Transporte de Personal (24-30 Pasajeros)', 'transporte_personal', 'Transporte de personal y cuadrillas', 'día', 850000.00, '28 Pasajeros con A/C', 'Ruta diaria de cuadrillas técnicas y operativas entre campamento base y frentes de obra.'),
    ('TR-VAN-15P', 'Van / Microbús de Personal (12-16 Pasajeros)', 'transporte_personal', 'Transporte de personal y cuadrillas', 'día', 650000.00, '15 Pasajeros con A/C', 'Movilización ágil de cuadrillas de soldadura, pintura industrial, instrumentación y topografía.'),
    ('TR-CAM-4X4', 'Camioneta 4x4 Doble Cabina Platón Diésel', 'vehiculos_livianos', 'Vehículos livianos y utilitarios 4x4', 'día', 520000.00, '5 Pasajeros + Platón 1 Ton', 'Transporte de ingenieros residentes, supervisores HSE y equipos de calibración.'),
    ('TR-CAM-DC-3T', 'Camión Doble Cabina 3.5 Ton con Carrocería de Estacas', 'vehiculos_livianos', 'Vehículos livianos y utilitarios 4x4', 'día', 720000.00, '5 Operarios + 3.5 Ton carga', 'Transporte conjunto de cuadrilla con compresor, equipos de oxicorte y consumibles.'),
    ('TR-BOTE-FLUVIAL', 'Bote a Motor Fuera de Borda / Transporte Fluvial', 'fluvial_especial', 'Transporte fluvial y logística especial', 'día', 480000.00, '12 Pasajeros con chalecos', 'Cruce de personal, herramientas e insumos por el río Cauca o ciénagas hacia derechos de vía.'),
    ('TR-CARR-AGUA', 'Camión Carrotanque de Agua / Combustible 2.500 Galones', 'fluvial_especial', 'Transporte fluvial y logística especial', 'día', 1100000.00, '2.500 Galones con motobomba', 'Suministro de agua para pruebas hidrostáticas y abastecimiento de diésel para maquinaria.'),
    ('TR-FLETE-EXPR', 'Flete Expreso Logística Caucasia - Frente de Obra', 'carga_pesada', 'Carga pesada y maquinaria (Lowboy / Cama alta)', 'viaje', 450000.00, 'Hasta 5 Toneladas', 'Envío urgente y puntual de repuestos, pernos, electrodos o equipos desde base operativa.')
) as s(code, name, category, category_label, unit, default_rate, capacity, description)
on conflict (company_id, code) do update
set
  name = excluded.name,
  category = excluded.category,
  category_label = excluded.category_label,
  unit = excluded.unit,
  default_rate = excluded.default_rate,
  capacity = excluded.capacity,
  description = excluded.description,
  updated_at = now();
