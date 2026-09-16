import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "src/modules/inventory/data/catalogo-inicial.json");
const destinationPath = resolve(root, "supabase/sql/seed_initial_inventory.sql");
const csvPath = resolve(root, "supabase/sql/inventory_import_staging.csv");
const items = JSON.parse(await readFile(sourcePath, "utf8"));

function literal(value) {
  if (value === null || value === undefined || value === "") return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const sourceRows = items.map((item) => `  (${[
  item.inventoryGroup,
  item.sourceRow,
  item.sku,
  item.name,
  item.category,
  item.brand === "N/A" ? null : item.brand,
  item.location,
  item.notes,
  item.unit,
  item.minimum,
  item.available,
].map(literal).join(", ")})`).join(",\n");

const sql = `-- RFC Enterprise · Carga inicial de inventario
-- Generado desde src/modules/inventory/data/catalogo-inicial.json.
-- Fuente: Inventario_Basico.xlsx. Conserva cada fila fuente para no mezclar
-- productos homónimos ubicados en bodegas o grupos diferentes.
-- Ejecutar después de initial_erp_schema.sql en Supabase SQL Editor.

begin;

create temporary table inventory_import (
  source_group text not null,
  source_row integer not null,
  sku text,
  name text not null,
  category text,
  brand text,
  location text,
  notes text,
  unit text not null,
  minimum_quantity numeric,
  quantity numeric not null
) on commit drop;

insert into inventory_import (
  source_group, source_row, sku, name, category, brand, location, notes,
  unit, minimum_quantity, quantity
) values
${sourceRows};

with company_branch as (
  select c.id as company_id, b.id as branch_id
  from public.companies c
  join public.branches b on b.company_id = c.id and b.code = 'caucasia'
  where c.slug = 'rfc'
)
insert into public.inventory_items (
  company_id, sku, name, category, brand, unit, notes,
  source_group, source_row, is_active
)
select cb.company_id, s.sku, s.name, s.category, s.brand, s.unit,
  s.notes, s.source_group, s.source_row, true
from inventory_import s
cross join company_branch cb
on conflict (company_id, source_group, source_row) do update set
  sku = excluded.sku,
  name = excluded.name,
  category = excluded.category,
  brand = excluded.brand,
  unit = excluded.unit,
  notes = excluded.notes,
  is_active = true;

with company_branch as (
  select c.id as company_id, b.id as branch_id
  from public.companies c
  join public.branches b on b.company_id = c.id and b.code = 'caucasia'
  where c.slug = 'rfc'
)
insert into public.inventory_stock (
  item_id, company_id, branch_id, inventory_group, location, quantity,
  minimum_quantity
)
select i.id, cb.company_id, cb.branch_id, s.source_group, s.location, s.quantity,
  s.minimum_quantity
from inventory_import s
cross join company_branch cb
join public.inventory_items i on i.company_id = cb.company_id
  and i.source_group = s.source_group
  and i.source_row = s.source_row
on conflict (item_id, branch_id, inventory_group, location) do update set
  quantity = excluded.quantity,
  minimum_quantity = excluded.minimum_quantity;

commit;

-- Validación esperada: 1,191 artículos y 12,495 unidades.
select
  count(*) as items,
  coalesce(sum(s.quantity), 0) as units,
  count(*) filter (where s.inventory_group = 'bodega') as bodega_items,
  count(*) filter (where s.inventory_group = 'dotacion') as dotacion_items,
  count(*) filter (where s.inventory_group = 'trabajadores') as trabajadores_items
from public.inventory_items i
join public.inventory_stock s on s.item_id = i.id
join public.companies c on c.id = i.company_id
where c.slug = 'rfc';
`;

await writeFile(destinationPath, sql, "utf8");
const columns = [
  "source_group", "source_row", "sku", "name", "category", "brand", "location",
  "notes", "unit", "minimum_quantity", "quantity",
];
const csvValue = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = [
  columns.join(","),
  ...items.map((item) => columns.map((column) => {
    const source = {
      source_group: item.inventoryGroup,
      source_row: item.sourceRow,
      sku: item.sku,
      name: item.name,
      category: item.category,
      brand: item.brand === "N/A" ? null : item.brand,
      location: item.location,
      notes: item.notes,
      unit: item.unit,
      minimum_quantity: item.minimum,
      quantity: item.available,
    };
    return csvValue(source[column]);
  }).join(",")),
].join("\n");
await writeFile(csvPath, csv, "utf8");
console.log(`Generated ${destinationPath} with ${items.length} inventory rows.`);
console.log(`Generated ${csvPath} for the one-time Supabase import.`);
