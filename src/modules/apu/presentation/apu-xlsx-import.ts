"use client";

import { apuCategoryMeta, type ApuCategory, type ApuLine } from "@/modules/apu";

/**
 * Lectura de un libro de Excel con el mismo formato del APU exportado.
 * No se lee por posición fija: se localiza la fila de cabeceras y se interpretan
 * los rótulos de cada rubro, de modo que si el usuario inserta filas, ordena
 * columnas o deja filas en blanco entre rubros, la importación sigue funcionando.
 */

export type ImportSeverity = "ok" | "warning" | "error";

export type ImportedLine = {
  rowNumber: number;
  category: ApuCategory;
  name: string;
  unit: string;
  quantity: number;
  yieldPerDay: number;
  dailyRate: number;
  partial: number;
  severity: ImportSeverity;
  messages: string[];
  /** Coincidencia con el catálogo de inventario, si se resolvió. */
  inventoryProductId?: string;
};

export type ApuImportPreview = {
  code: string;
  name: string;
  unit: string;
  workQuantity: number;
  quoteCode?: string;
  sheetName: string;
  lines: ImportedLine[];
  missingQuantityCount: number;
  errorCount: number;
  warningCount: number;
  /** Filas que no se pudieron interpretar y se informan al usuario en la vista previa. */
  skipped: Array<{ rowNumber: number; reason: string; text: string }>;
};

const CATEGORY_BY_LABEL: Record<string, ApuCategory> = (() => {
  const map: Record<string, ApuCategory> = {};
  for (const [key, meta] of Object.entries(apuCategoryMeta)) {
    const label = meta.label.toLowerCase();
    map[label] = key as ApuCategory;
    // tolerate plurales y diferencias de tildes/guiones que el usuario suele escribir
    map[label.replace(/s$/, "")] = key as ApuCategory;
    map[label.replace(/es$/, "")] = key as ApuCategory;
    map[label.replace(/[^a-zñáéíóú]/g, "")] = key as ApuCategory;
  }
  // sinónimos habituales en obras
  map["mano de obra"] = "labor";
  map["mano obra"] = "labor";
  map["materiales e insumos"] = "materials";
  map["equipos herramientas"] = "equipment";
  map["equipo"] = "equipment";
  map["herramientas"] = "equipment";
  map["transportes"] = "transport";
  return map;
})();

const normalize = (value: string) =>
  value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Acepta "1.234,56", "1234.56", "1 234", "$ 45.000" y "2 und" → número. */
export function parseNumericCell(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;

  if (typeof value === "object") {
    const rich = value as { richText?: Array<{ text?: string }>; text?: string; result?: unknown; formula?: string };
    if (Array.isArray(rich.richText)) return parseNumericCell(rich.richText.map((part) => part.text ?? "").join(""));
    if (rich.result !== undefined) return parseNumericCell(rich.result);
    if (rich.text !== undefined) return parseNumericCell(rich.text);
    return null;
  }

  const raw = value.toString().replace(/\$/g, "").replace(/\s/g, "").replace(/%/g, "").trim();
  if (!raw) return null;
  // texto con unidades: se toma el primer número que aparezca ("2 und" → 2)
  const match = raw.match(/-?[\d.,]+/);
  if (!match) return null;
  let candidate = match[0];

  const lastComma = candidate.lastIndexOf(",");
  const lastDot = candidate.lastIndexOf(".");
  if (lastComma > lastDot) {
    // formato colombiano: punto de miles, coma decimal
    candidate = candidate.replace(/\./g, "").replace(",", ".");
  } else {
    // formato anglosajón: quitar comas de miles
    candidate = candidate.replace(/,/g, "");
  }
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const rich = value as { richText?: Array<{ text?: string }>; text?: string; formula?: string; result?: unknown };
    if (Array.isArray(rich.richText)) return rich.richText.map((part) => part.text ?? "").join("").trim();
    if (rich.text !== undefined) return String(rich.text).trim();
    if (rich.formula !== undefined) return String(rich.result ?? "").trim();
  }
  return String(value).trim();
};

type ExcelRow = { rowNumber: number; values: unknown[] };

const rowValues = (row: ExcelRow): unknown[] => {
  const anyRow = row.values as unknown;
  if (Array.isArray(anyRow)) return anyRow as unknown[];
  return [];
};

/** "Total Materiales", "Total Equipos y herramientas" → subtotal, no una línea. */
const isSubtotalRow = (text: string) => /^total\b/i.test(text.trim());
const isSummaryRow = (text: string) => /^(resumen|costo directo|ganancia|precio)/i.test(text.trim());

/**
 * Localiza la fila de cabeceras: la primera que tenga un texto de recurso en la
 * columna A y al menos tres celdas numéricas o de encabezado a la derecha.
 */
function findHeaderRow(rows: ExcelRow[]): { row: ExcelRow; columnIndex: number } | null {
  for (const row of rows) {
    const values = rowValues(row);
    for (let column = 0; column < Math.min(values.length, 4); column += 1) {
      const text = normalize(cellText(values[column]));
      if (text.includes("recurso") || text.includes("descripcion")) {
        return { row, columnIndex: column };
      }
    }
  }
  return null;
}

export function previewApuWorkbook(fileBuffer: ArrayBuffer): Promise<ApuImportPreview> {
  return import("exceljs").then(async (module) => {
    const ExcelJS = (module as { default?: unknown }).default ?? module;
    const workbook = new (ExcelJS as typeof import("exceljs")).Workbook();
    await workbook.xlsx.load(fileBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("El archivo no contiene ninguna hoja de cálculo.");

    const rows: ExcelRow[] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values = row.values as unknown;
      rows.push({
        rowNumber,
        values: Array.isArray(values) ? (values as unknown[]).slice(1) : [],
      });
    });

    const header = findHeaderRow(rows);
    if (!header) {
      throw new Error(
        "No se encontró la fila de encabezados. Usa el archivo exportado por RFC Enterprise o conserva la fila que dice RECURSO.",
      );
    }

    const base = header.columnIndex;
    const at = (values: unknown[], offset: number) => values[base + offset];

    // Metadatos del análisis: se buscan antes de la cabecera ("Código", "Actividad"...).
    let code = "";
    let name = "";
    let unit = "";
    let workQuantity = 0;
    let quoteCode: string | undefined;

    for (const row of rows) {
      if (row.rowNumber >= header.row.rowNumber) break;
      const values = rowValues(row);
      // Los metadatos pueden estar en cualquier par de columnas (A/B, D/E...),
      // así que se recorre la fila completa en vez de asumir posiciones fijas.
      for (let column = 0; column < values.length - 1; column += 1) {
        const label = normalize(cellText(values[column]));
        if (!label) continue;
        // El valor puede estar en la celda siguiente o en una celda combinada.
        let valueCell = values[column + 1];
        if (!cellText(valueCell)) {
          for (let ahead = column + 2; ahead < Math.min(values.length, column + 4); ahead += 1) {
            const candidate = values[ahead];
            if (cellText(candidate)) { valueCell = candidate; break; }
          }
        }
        if (label === "codigo") code = cellText(valueCell);
        else if (label === "actividad") name = cellText(valueCell);
        else if (label === "unidad") unit = cellText(valueCell);
        else if (label === "cantidad de obra" || label === "cantidad de la obra") workQuantity = parseNumericCell(valueCell) ?? 0;
        else if (label === "cotizacion") quoteCode = cellText(valueCell);
      }
    }

    const lines: ImportedLine[] = [];
    const skipped: ApuImportPreview["skipped"] = [];
    let currentCategory: ApuCategory | null = null;

    for (const row of rows) {
      if (row.rowNumber <= header.row.rowNumber) continue;
      const values = rowValues(row);
      const resourceText = cellText(at(values, 0));
      if (!resourceText) continue;

      if (isSummaryRow(resourceText)) continue;

      const normalized = normalize(resourceText);
      if (isSubtotalRow(resourceText)) {
        currentCategory = null;
        continue;
      }

      const matchedCategory = CATEGORY_BY_LABEL[normalized] ?? CATEGORY_BY_LABEL[normalized.replace(/\s+/g, "")];
      if (matchedCategory && !cellText(at(values, 1)) && !parseNumericCell(at(values, 2))) {
        currentCategory = matchedCategory;
        continue;
      }

      if (!currentCategory) {
        skipped.push({
          rowNumber: row.rowNumber,
          reason: "Está fuera de un rubro reconocido",
          text: resourceText.slice(0, 80),
        });
        continue;
      }

      const quantityCell = at(values, 2);
      const parsedQuantity = parseNumericCell(quantityCell);
      const yieldCell = at(values, 3);
      const parsedYield = parseNumericCell(yieldCell);
      const rateCell = at(values, 4);
      const parsedRate = parseNumericCell(rateCell);
      const partialCell = at(values, 5);

      const messages: string[] = [];
      let severity: ImportSeverity = "ok";

      if (parsedQuantity === null || parsedQuantity <= 0) {
        messages.push(
          cellText(quantityCell)
            ? `La cantidad "${cellText(quantityCell)}" no es un número válido`
            : "La línea llegó sin cantidad",
        );
        severity = "warning";
      }
      if (parsedRate === null || parsedRate < 0) {
        messages.push(cellText(rateCell) ? `La tarifa "${cellText(rateCell)}" no es válida` : "La línea llegó sin tarifa");
        severity = "error";
      }

      const quantity = parsedQuantity && parsedQuantity > 0 ? parsedQuantity : 0;
      const yieldPerDay = currentCategory === "materials" ? 1 : parsedYield ?? 1;
      const dailyRate = parsedRate && parsedRate >= 0 ? parsedRate : 0;
      const computedPartial = quantity * dailyRate * (currentCategory === "materials" ? 1 : yieldPerDay || 1);
      const declaredPartial = parseNumericCell(partialCell);

      if (declaredPartial !== null && computedPartial > 0) {
        const drift = Math.abs(declaredPartial - computedPartial) / computedPartial;
        if (drift > 0.01) {
          messages.push("El parcial del archivo no coincide con cantidad × tarifa; se usará el cálculo del sistema");
          severity = severity === "error" ? "error" : "warning";
        }
      }

      lines.push({
        rowNumber: row.rowNumber,
        category: currentCategory,
        name: resourceText,
        unit: cellText(at(values, 1)) || unit,
        quantity,
        yieldPerDay,
        dailyRate,
        partial: computedPartial,
        severity,
        messages,
      });
    }

    return {
      code,
      name,
      unit,
      workQuantity,
      quoteCode: quoteCode && quoteCode !== "—" ? quoteCode : undefined,
      sheetName: sheet.name,
      lines,
      missingQuantityCount: lines.filter((line) => line.messages.some((message) => message.includes("cantidad"))).length,
      errorCount: lines.filter((line) => line.severity === "error").length,
      warningCount: lines.filter((line) => line.severity === "warning").length,
      skipped,
    };
  });
}

/**
 * Convierte la vista previa en las líneas del APU.
 * `includeWithoutQuantity` es la decisión explícita del usuario sobre las líneas
 * que llegaron sin cantidad: si las trae, entran con 1 para que puedas ajustarlas
 * en la actividad; si no, quedan fuera del APU.
 */
export function previewToApuLines(preview: ApuImportPreview, excludedRows: ReadonlySet<number>, includeWithoutQuantity: boolean): ApuLine[] {
  return preview.lines
    .filter((line) => !excludedRows.has(line.rowNumber))
    .filter((line) => (includeWithoutQuantity ? true : line.quantity > 0))
    .filter((line) => line.severity !== "error")
    .map((line) => ({
      id: `import-${line.rowNumber}`,
      category: line.category,
      name: line.name,
      quantity: line.quantity > 0 ? line.quantity : 1,
      yieldPerDay: line.yieldPerDay,
      dailyRate: line.dailyRate,
      unit: line.unit || undefined,
    }));
}

/** Líneas que entrarán con una cantidad de relleno y que conviene revisar después. */
export const needsQuantityReview = (preview: ApuImportPreview, excludedRows: ReadonlySet<number>, includeWithoutQuantity: boolean) =>
  includeWithoutQuantity
    ? preview.lines.filter((line) => !excludedRows.has(line.rowNumber) && line.severity !== "error" && line.quantity <= 0)
    : [];

export const previewTotals = (
  preview: ApuImportPreview,
  excludedRows: ReadonlySet<number>,
  includeWithoutQuantity: boolean,
) => {
  const usable = preview.lines.filter(
    (line) => !excludedRows.has(line.rowNumber) && line.severity !== "error" && (line.quantity > 0 || includeWithoutQuantity),
  );
  return {
    materials: usable.filter((line) => line.category === "materials").reduce((sum, line) => sum + line.partial, 0),
    equipment: usable.filter((line) => line.category === "equipment").reduce((sum, line) => sum + line.partial, 0),
    labor: usable.filter((line) => line.category === "labor").reduce((sum, line) => sum + line.partial, 0),
    transport: usable.filter((line) => line.category === "transport").reduce((sum, line) => sum + line.partial, 0),
  };
};
