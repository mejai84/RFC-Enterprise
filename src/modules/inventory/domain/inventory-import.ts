/**
 * Contrato de importación masiva de inventario.
 *
 * La importación es de ALTAS: cada fila crea un artículo nuevo con su
 * existencia de apertura mediante la RPC existente
 * `create_inventory_item_with_opening_balance`. No actualiza artículos que ya
 * existen. La validación se ejecuta en el navegador para la vista previa y se
 * repite en el servidor antes de escribir.
 *
 * `inventory_items.sku` no tiene una restricción única en la base actual, por
 * lo que la deduplicación es una regla de aplicación. Una restricción durable
 * requiere una migración coordinada (INV-011 / INV-026).
 */

export const INVENTORY_IMPORT_MAX_ROWS = 500;
export const INVENTORY_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_NUMERIC_VALUE = 99_999_999_999.999;

export type InventoryImportGroup = "bodega" | "dotacion" | "trabajadores";

export type InventoryImportRawRow = {
  rowNumber: number;
  sku: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  inventoryGroup: string;
  location: string;
  quantity: string;
  minimumQuantity: string;
  unitCost: string;
  notes: string;
  sourceRow: string;
};

export type InventoryImportValidatedRow = {
  rowNumber: number;
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  unit: string;
  inventoryGroup: InventoryImportGroup;
  location: string | null;
  quantity: number;
  minimumQuantity: number | null;
  unitCost: number;
  notes: string | null;
  sourceRow: number | null;
  errors: string[];
};

export type InventoryImportPreview = {
  rows: InventoryImportValidatedRow[];
  total: number;
  valid: number;
  invalid: number;
  duplicateSkuRows: number;
  existingSkuRows: number;
  fileError: string | null;
  ignoredColumns: string[];
  missingOptionalColumns: string[];
  hasUnitCostColumn: boolean;
};

export type InventoryImportMatrix = {
  rawRows: InventoryImportRawRow[];
  fileError: string | null;
  ignoredColumns: string[];
  missingOptionalColumns: string[];
  hasUnitCostColumn: boolean;
};

type ImportField =
  | "sku"
  | "name"
  | "category"
  | "brand"
  | "unit"
  | "inventoryGroup"
  | "location"
  | "quantity"
  | "minimumQuantity"
  | "unitCost"
  | "notes"
  | "sourceRow";

const HEADER_ALIASES: Record<ImportField, string[]> = {
  sku: ["sku", "codigo", "codigo_sku", "codigo_articulo", "codigo_de_articulo"],
  name: ["name", "nombre", "articulo", "descripcion", "descripcion_articulo"],
  category: ["category", "categoria", "tipo", "tipo_articulo"],
  brand: ["brand", "marca", "fabricante"],
  unit: ["unit", "unidad", "unidad_consumo", "unidad_de_consumo", "um"],
  inventoryGroup: [
    "inventory_group",
    "inventorygroup",
    "group",
    "grupo",
    "grupo_inventario",
    "grupo_de_inventario",
    "source_group",
    "sourcegroup",
  ],
  location: ["location", "ubicacion", "localizacion", "estante", "lugar"],
  quantity: ["quantity", "cantidad", "existencia", "existencias", "stock", "saldo"],
  minimumQuantity: [
    "minimum_quantity",
    "minimumquantity",
    "minimo",
    "stock_minimo",
    "cantidad_minima",
    "cantidad_minima_requerida",
  ],
  unitCost: [
    "unit_cost",
    "unitcost",
    "costo_unitario",
    "costo",
    "valor_unitario",
    "valor",
  ],
  notes: ["notes", "notas", "observaciones", "detalle"],
  sourceRow: ["source_row", "sourcerow", "fila_origen", "fila"],
};

const REQUIRED_FIELDS: ImportField[] = ["sku", "name", "unit", "inventoryGroup", "quantity"];
const OPTIONAL_FIELDS: ImportField[] = [
  "category",
  "brand",
  "location",
  "minimumQuantity",
  "unitCost",
  "notes",
  "sourceRow",
];

const FIELD_LIMITS: Partial<Record<ImportField, number>> = {
  sku: 80,
  name: 240,
  category: 120,
  brand: 120,
  unit: 40,
  location: 160,
  notes: 1_000,
};

const HEADER_LABELS: Record<ImportField, string> = {
  sku: "SKU",
  name: "Nombre",
  category: "Categoría",
  brand: "Marca",
  unit: "Unidad",
  inventoryGroup: "Grupo de inventario",
  location: "Ubicación",
  quantity: "Cantidad",
  minimumQuantity: "Stock mínimo",
  unitCost: "Costo unitario",
  notes: "Notas",
  sourceRow: "Fila de origen",
};

export function normalizeImportHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fieldForHeader(header: string): ImportField | null {
  const normalized = normalizeImportHeader(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    ImportField,
    string[],
  ][]) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r\n/g, "\n").trim();
}

function findHeaderRow(matrix: string[][]): number {
  return matrix.findIndex((row) => row.some((cell) => cleanCell(cell) !== ""));
}

function buildHeaderIndex(headerRow: string[]) {
  const index = new Map<ImportField, number>();
  const ignoredColumns: string[] = [];
  headerRow.forEach((header, column) => {
    const cleaned = cleanCell(header);
    if (!cleaned) return;
    const field = fieldForHeader(cleaned);
    if (field) {
      if (!index.has(field)) index.set(field, column);
      else ignoredColumns.push(cleaned);
    } else {
      ignoredColumns.push(cleaned);
    }
  });
  return { index, ignoredColumns };
}

export function parseInventoryMatrix(matrix: string[][]): InventoryImportMatrix {
  const headerRowIndex = findHeaderRow(matrix);
  if (headerRowIndex < 0) {
    return {
      rawRows: [],
      fileError: "El archivo está vacío. Descarga la plantilla y agrega al menos una fila.",
      ignoredColumns: [],
      missingOptionalColumns: [],
      hasUnitCostColumn: false,
    };
  }

  const { index, ignoredColumns } = buildHeaderIndex(matrix[headerRowIndex]);
  const missingRequired = REQUIRED_FIELDS.filter((field) => !index.has(field));
  if (missingRequired.length) {
    return {
      rawRows: [],
      fileError:
        "Faltan columnas obligatorias: " +
        missingRequired.map((field) => HEADER_LABELS[field]).join(", ") +
        ". Usa la plantilla para conservar los encabezados.",
      ignoredColumns,
      missingOptionalColumns: [],
      hasUnitCostColumn: false,
    };
  }

  const dataRows = matrix
    .slice(headerRowIndex + 1)
    .map((row, offset) => ({ row, rowNumber: headerRowIndex + offset + 2 }))
    .filter(({ row }) => row.some((cell) => cleanCell(cell) !== ""));

  if (!dataRows.length) {
    return {
      rawRows: [],
      fileError: "El archivo no tiene filas de datos para importar.",
      ignoredColumns,
      missingOptionalColumns: [],
      hasUnitCostColumn: false,
    };
  }

  if (dataRows.length > INVENTORY_IMPORT_MAX_ROWS) {
    return {
      rawRows: [],
      fileError: `El archivo tiene ${dataRows.length} filas y el máximo es ${INVENTORY_IMPORT_MAX_ROWS}. Divide la importación en varios archivos.`,
      ignoredColumns,
      missingOptionalColumns: [],
      hasUnitCostColumn: false,
    };
  }

  const value = (row: string[], field: ImportField) => {
    const column = index.get(field);
    return column === undefined ? "" : cleanCell(row[column]);
  };

  const rawRows: InventoryImportRawRow[] = dataRows.map(({ row, rowNumber }) => ({
    rowNumber,
    sku: value(row, "sku"),
    name: value(row, "name"),
    category: value(row, "category"),
    brand: value(row, "brand"),
    unit: value(row, "unit"),
    inventoryGroup: value(row, "inventoryGroup"),
    location: value(row, "location"),
    quantity: value(row, "quantity"),
    minimumQuantity: value(row, "minimumQuantity"),
    unitCost: value(row, "unitCost"),
    notes: value(row, "notes"),
    sourceRow: value(row, "sourceRow"),
  }));

  return {
    rawRows,
    fileError: null,
    ignoredColumns,
    missingOptionalColumns: OPTIONAL_FIELDS.filter((field) => !index.has(field)).map(
      (field) => HEADER_LABELS[field],
    ),
    hasUnitCostColumn: index.has("unitCost"),
  };
}

function parseNumber(value: string): number | null {
  const cleaned = value
    .replace(/\u00a0/g, " ")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // Formato colombiano: 1.234,56
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato anglosajón: 1,234.56
      normalized = normalized.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const commaCount = (normalized.match(/,/g) ?? []).length;
    normalized =
      commaCount > 1
        ? normalized.replace(/,/g, "")
        : normalized.replace(",", ".");
  } else if (lastDot >= 0) {
    const dotCount = (normalized.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      // Varios puntos sin coma: separadores de miles.
      normalized = normalized.replace(/\./g, "");
    } else if (/^\d{1,3}\.\d{3}$/.test(normalized) && !/^0+\./.test(normalized)) {
      // En Colombia 28.500 representa veintiocho mil quinientos. Se evita
      // interpretar 0.500 como 500 para conservar los decimales.
      normalized = normalized.replace(".", "");
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGroup(value: string): InventoryImportGroup | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized === "bodega") return "bodega";
  if (normalized === "dotacion") return "dotacion";
  if (normalized === "trabajadores" || normalized === "trabajador") {
    return "trabajadores";
  }
  return null;
}

function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

function validateLength(
  value: string,
  field: ImportField,
  errors: string[],
): void {
  const limit = FIELD_LIMITS[field];
  if (limit && value.length > limit) {
    errors.push(`${HEADER_LABELS[field]} supera ${limit} caracteres.`);
  }
}

function validateRawRow(
  raw: InventoryImportRawRow,
  existingSkus: Set<string>,
): InventoryImportValidatedRow {
  const errors: string[] = [];
  const sku = raw.sku.trim();
  const name = raw.name.trim();
  const unit = raw.unit.trim();
  const group = normalizeGroup(raw.inventoryGroup);

  if (!sku) errors.push("El SKU es obligatorio.");
  if (!name) errors.push("El nombre es obligatorio.");
  if (!unit) errors.push("La unidad de consumo es obligatoria.");
  if (!group) {
    errors.push(
      "El grupo debe ser bodega, dotación o trabajadores (o la columna source_group equivalente).",
    );
  }

  validateLength(sku, "sku", errors);
  validateLength(name, "name", errors);
  validateLength(raw.category, "category", errors);
  validateLength(raw.brand, "brand", errors);
  validateLength(unit, "unit", errors);
  validateLength(raw.location, "location", errors);
  validateLength(raw.notes, "notes", errors);

  const quantity = raw.quantity.trim() === "" ? 0 : parseNumber(raw.quantity);
  if (
    quantity === null ||
    quantity < 0 ||
    quantity > MAX_NUMERIC_VALUE
  ) {
    errors.push(
      "La cantidad debe ser un número mayor o igual a cero y dentro del rango permitido.",
    );
  }

  const minimumText = raw.minimumQuantity.trim();
  const minimumQuantity = minimumText === "" ? null : parseNumber(minimumText);
  if (
    minimumText !== "" &&
    (minimumQuantity === null ||
      minimumQuantity < 0 ||
      minimumQuantity > MAX_NUMERIC_VALUE)
  ) {
    errors.push(
      "El stock mínimo debe ser un número mayor o igual a cero y dentro del rango permitido.",
    );
  }

  const unitCost = raw.unitCost.trim() === "" ? 0 : parseNumber(raw.unitCost);
  if (
    unitCost === null ||
    unitCost < 0 ||
    unitCost > MAX_NUMERIC_VALUE
  ) {
    errors.push(
      "El costo unitario debe ser un número mayor o igual a cero y dentro del rango permitido.",
    );
  }

  const sourceRowText = raw.sourceRow.trim();
  const parsedSourceRow =
    sourceRowText === "" ? null : Number(sourceRowText);
  const sourceRow =
    parsedSourceRow !== null &&
    Number.isInteger(parsedSourceRow) &&
    parsedSourceRow > 0
      ? parsedSourceRow
      : null;
  if (sourceRowText !== "" && sourceRow === null) {
    errors.push("La fila de origen debe ser un entero positivo.");
  }

  if (sku && existingSkus.has(normalizeSku(sku))) {
    errors.push(
      "El SKU ya existe en el catálogo. Esta importación solo crea artículos nuevos.",
    );
  }

  return {
    rowNumber: raw.rowNumber,
    sku,
    name,
    category: raw.category.trim() || null,
    brand: raw.brand.trim() || null,
    unit,
    inventoryGroup: group ?? "bodega",
    location: raw.location.trim() || null,
    quantity: quantity ?? 0,
    minimumQuantity,
    unitCost: unitCost ?? 0,
    notes: raw.notes.trim() || null,
    sourceRow,
    errors,
  };
}

export function validateInventoryImportRawRows(
  rawRows: InventoryImportRawRow[],
  options: {
    existingSkus?: Iterable<string>;
    fileError?: string | null;
    ignoredColumns?: string[];
    missingOptionalColumns?: string[];
    hasUnitCostColumn?: boolean;
  } = {},
): InventoryImportPreview {
  const existingSkus = new Set(
    [...(options.existingSkus ?? [])].map((sku) => normalizeSku(sku)),
  );
  const rows = rawRows.map((raw) => validateRawRow(raw, existingSkus));

  // Un SKU repetido dentro del archivo es ambiguo: se marcan todas sus filas
  // para que el usuario decida cuál conservar antes de confirmar.
  const bySku = new Map<string, InventoryImportValidatedRow[]>();
  for (const row of rows) {
    if (!row.sku) continue;
    const key = normalizeSku(row.sku);
    const group = bySku.get(key) ?? [];
    group.push(row);
    bySku.set(key, group);
  }
  let duplicateSkuRows = 0;
  for (const group of bySku.values()) {
    if (group.length < 2) continue;
    duplicateSkuRows += group.length;
    const rowNumbers = group.map((row) => row.rowNumber).join(", ");
    for (const row of group) {
      row.errors.push(`SKU duplicado dentro del archivo (filas ${rowNumbers}).`);
    }
  }

  const valid = rows.filter((row) => row.errors.length === 0).length;
  return {
    rows,
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    duplicateSkuRows,
    existingSkuRows: rows.filter(
      (row) => Boolean(row.sku) && existingSkus.has(normalizeSku(row.sku)),
    ).length,
    fileError: options.fileError ?? null,
    ignoredColumns: options.ignoredColumns ?? [],
    missingOptionalColumns: options.missingOptionalColumns ?? [],
    hasUnitCostColumn: options.hasUnitCostColumn ?? false,
  };
}

export function createInventoryImportPreview(
  matrix: string[][],
  existingSkus: Iterable<string> = [],
): InventoryImportPreview {
  const parsed = parseInventoryMatrix(matrix);
  return validateInventoryImportRawRows(parsed.rawRows, {
    existingSkus,
    fileError: parsed.fileError,
    ignoredColumns: parsed.ignoredColumns,
    missingOptionalColumns: parsed.missingOptionalColumns,
    hasUnitCostColumn: parsed.hasUnitCostColumn,
  });
}

export function parseInventoryCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character === "\r") {
      // Se ignora; el salto de línea se procesa con \n.
    } else {
      cell += character;
    }
  }

  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function escapeCsv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildInventoryImportTemplateCsv(): string {
  const headers = [
    "sku",
    "nombre",
    "categoria",
    "marca",
    "unidad",
    "source_group",
    "ubicacion",
    "cantidad",
    "stock_minimo",
    "costo_unitario",
    "notas",
  ];
  const example = [
    "SKU-EJEMPLO-001",
    "Cemento gris 50 kg",
    "Materiales de construcción",
    "Marca de ejemplo",
    "bulto",
    "bodega",
    "Estantería 1",
    "10",
    "2",
    "28500",
    "Reemplaza esta fila por tus datos.",
  ];
  return "\uFEFF" + [headers, example].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

export function buildInventoryImportErrorsCsv(
  rows: InventoryImportValidatedRow[],
): string {
  const headers = ["fila", "sku", "nombre", "errores"];
  const data = rows
    .filter((row) => row.errors.length)
    .map((row) => [
      row.rowNumber,
      row.sku,
      row.name,
      row.errors.join(" | "),
    ]);
  return "\uFEFF" + [headers, ...data].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}
