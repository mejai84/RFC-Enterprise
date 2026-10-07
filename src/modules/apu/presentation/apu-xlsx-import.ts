"use client";

import type { ApuCategory, ApuLine } from "@/modules/apu";

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
  skipped: Array<{ rowNumber: number; reason: string; text: string }>;
  sourceFormat: "rfc" | "reference" | "detected";
  confidence: "high" | "medium";
  categoryCounts: Record<ApuCategory, number>;
};

export type ApuWorkbookInspection = {
  sheets: ApuImportPreview[];
  ignoredSheets: Array<{ sheetName: string; reason: string }>;
};

type ExcelRow = { rowNumber: number; values: unknown[] };
type ColumnMap = {
  resource: number;
  category?: number;
  unit?: number;
  quantity?: number;
  yieldPerDay?: number;
  rate?: number;
  partial?: number;
};

const MAX_FILE_SHEETS = 100;
const MAX_ROWS_PER_SHEET = 5000;
const MAX_COLUMNS_PER_ROW = 64;
const MAX_LINES_PER_SHEET = 2000;

const CATEGORY_LABELS: Record<ApuCategory, string> = {
  equipment: "Equipos y herramientas",
  materials: "Materiales",
  labor: "Mano de obra",
  transport: "Transporte",
};

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

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

const normalizedLabel = (value: unknown) =>
  normalize(cellText(value)).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/** Acepta formatos colombianos, anglosajones, moneda, fórmulas y texto con unidad. */
export function parseNumericCell(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;
  if (typeof value === "object") {
    const rich = value as { richText?: Array<{ text?: string }>; text?: string; result?: unknown };
    if (Array.isArray(rich.richText)) return parseNumericCell(rich.richText.map((part) => part.text ?? "").join(""));
    if (rich.result !== undefined) return parseNumericCell(rich.result);
    if (rich.text !== undefined) return parseNumericCell(rich.text);
    return null;
  }

  const raw = value.toString().replace(/\$/g, "").replace(/\s/g, "").replace(/%/g, "").trim();
  const match = raw.match(/-?[\d.,]+/);
  if (!match) return null;
  let candidate = match[0];
  const lastComma = candidate.lastIndexOf(",");
  const lastDot = candidate.lastIndexOf(".");
  candidate = lastComma > lastDot
    ? candidate.replace(/\./g, "").replace(",", ".")
    : candidate.replace(/,/g, "");
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

const rowValues = (row: ExcelRow) => row.values;
const isSubtotalRow = (text: string) => /^(total|subtotal)\b/i.test(text.trim());
const isSummaryRow = (text: string) => /^(resumen|costo directo|ganancia|precio de venta)/i.test(text.trim());

function categoryFromCell(value: unknown): ApuCategory | null {
  const label = normalizedLabel(value);
  if (/^equipos?( y herramientas)?$/.test(label) || label === "herramientas") return "equipment";
  if (/^material(es)?( e insumos)?$/.test(label) || label === "insumos") return "materials";
  if (/^(mano de obra|mano obra|personal|labor)$/.test(label)) return "labor";
  if (/^(transporte|transportes|flete|fletes)$/.test(label)) return "transport";
  return null;
}

function headerRole(value: unknown): keyof ColumnMap | null {
  const label = normalizedLabel(value);
  if (/^(rubro|categoria|tipo de recurso|grupo)$/.test(label)) return "category";
  if (/^(recurso|descripcion|detalle|insumo|item|concepto|cargo)$/.test(label)) return "resource";
  if (/^(und|unidad|unidad de medida|u m|um)$/.test(label)) return "unit";
  if (/^(cant|cantidad|coeficiente|consumo)$/.test(label)) return "quantity";
  if (/(rend|rendimiento|duracion|jornada)/.test(label)) return "yieldPerDay";
  if (/(vr parcial|valor parcial|costo parcial|subtotal|importe)/.test(label)) return "partial";
  if (/(tarifa|salario|jornal|precio unitario|valor unitario|costo unitario|precio$)/.test(label)) return "rate";
  return null;
}

function detectColumns(values: unknown[], resourceFallback = 0): ColumnMap {
  const map: ColumnMap = { resource: resourceFallback };
  values.slice(0, MAX_COLUMNS_PER_ROW).forEach((value, index) => {
    const role = headerRole(value);
    if (role && map[role] === undefined) map[role] = index;
  });
  return map;
}

function categoryMarkers(values: unknown[]) {
  return values.slice(0, MAX_COLUMNS_PER_ROW)
    .map((value, column) => ({ category: categoryFromCell(value), column }))
    .filter((marker): marker is { category: ApuCategory; column: number } => Boolean(marker.category));
}

function findTableHeader(rows: ExcelRow[]) {
  for (const row of rows) {
    const values = rowValues(row);
    const columns = detectColumns(values);
    const roles = values.map(headerRole);
    if (roles.includes("resource") && columns.quantity !== undefined && (columns.rate !== undefined || columns.partial !== undefined)) {
      return { row, columns };
    }
  }
  return null;
}

function findMetadataValue(rows: ExcelRow[], cutoffRow: number, labels: string[]): string {
  for (const row of rows) {
    if (row.rowNumber >= cutoffRow) break;
    const values = rowValues(row);
    for (let column = 0; column < values.length - 1; column += 1) {
      if (!labels.includes(normalizedLabel(values[column]))) continue;
      for (let ahead = column + 1; ahead < Math.min(values.length, column + 4); ahead += 1) {
        const value = cellText(values[ahead]);
        if (value) return value;
      }
    }
  }
  return "";
}

function firstDescriptiveText(rows: ExcelRow[], beforeRow: number, fallback: string) {
  for (const row of rows) {
    if (row.rowNumber >= beforeRow) break;
    const unique = Array.from(new Set(rowValues(row).map(cellText).filter(Boolean)));
    const value = unique.find((text) => /[a-záéíóúñ]{3}/i.test(text) && !headerRole(text) && !categoryFromCell(text));
    if (value) return value.replace(/^umm\s+/i, "").trim();
  }
  return fallback.trim();
}

function parseSheet(sheet: import("exceljs").Worksheet): { preview?: ApuImportPreview; reason?: string } {
  if (sheet.rowCount > MAX_ROWS_PER_SHEET) return { reason: `Supera el límite de ${MAX_ROWS_PER_SHEET} filas` };
  if (/^(resumen|tabla|catalogo|catálogo|herramientas mat)/i.test(sheet.name.trim())) return { reason: "Es una hoja auxiliar o de catálogo" };

  const rows: ExcelRow[] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = row.values as unknown;
    rows.push({ rowNumber, values: Array.isArray(values) ? (values as unknown[]).slice(1, MAX_COLUMNS_PER_ROW + 1) : [] });
  });

  const markerRows = rows.map((row) => ({ row, markers: categoryMarkers(rowValues(row)) })).filter(({ markers }) => markers.length);
  if (markerRows.some(({ markers }) => markers.length > 1)) return { reason: "Es un catálogo con varios rubros en paralelo" };
  const tableHeader = findTableHeader(rows);
  if (!tableHeader && !markerRows.length) return { reason: "No contiene rubros ni una tabla APU reconocible" };

  const firstDataRow = tableHeader?.row.rowNumber ?? markerRows[0].row.rowNumber;
  const hasRfcMetadata = Boolean(findMetadataValue(rows, firstDataRow, ["codigo", "actividad"]));
  const sourceFormat: ApuImportPreview["sourceFormat"] = tableHeader ? (hasRfcMetadata ? "rfc" : "detected") : "reference";
  const code = findMetadataValue(rows, firstDataRow, ["codigo", "codigo apu"]);
  let name = findMetadataValue(rows, firstDataRow, ["actividad", "analisis", "analisis apu"]);
  let unit = findMetadataValue(rows, firstDataRow, ["unidad", "unidad de medida"]);
  let workQuantity = parseNumericCell(findMetadataValue(rows, firstDataRow, ["cantidad de obra", "cantidad de la obra"])) ?? 0;
  const quoteCode = findMetadataValue(rows, firstDataRow, ["cotizacion", "codigo cotizacion"]);

  if (sourceFormat === "reference") {
    const firstMarker = markerRows[0];
    name ||= firstDescriptiveText(rows, firstMarker.row.rowNumber, sheet.name);
    const values = rowValues(firstMarker.row);
    const columns = detectColumns(values, firstMarker.markers[0].column);
    const lastKnown = Math.max(columns.partial ?? -1, columns.rate ?? -1, columns.yieldPerDay ?? -1, columns.quantity ?? -1);
    for (let column = lastKnown + 1; column < values.length; column += 1) {
      const candidate = cellText(values[column]);
      if (!candidate || parseNumericCell(candidate) !== null) continue;
      unit = candidate;
      for (const row of rows.filter((item) => item.rowNumber > firstMarker.row.rowNumber).slice(0, 3)) {
        const quantity = parseNumericCell(rowValues(row)[column]);
        if (quantity !== null && quantity > 0) { workQuantity = quantity; break; }
      }
      break;
    }
  }

  name ||= sheet.name.trim();
  unit ||= "und";
  const lines: ImportedLine[] = [];
  const skipped: ApuImportPreview["skipped"] = [];
  let currentCategory: ApuCategory | null = null;
  let columns = tableHeader?.columns ?? detectColumns([], 0);

  for (const row of rows) {
    if (tableHeader && row.rowNumber <= tableHeader.row.rowNumber) continue;
    const values = rowValues(row);
    const markers = categoryMarkers(values);
    if (markers.length === 1) {
      currentCategory = markers[0].category;
      const sectionColumns = detectColumns(values, markers[0].column);
      if (sectionColumns.quantity !== undefined || sectionColumns.rate !== undefined) columns = sectionColumns;
      continue;
    }

    const category = (columns.category !== undefined ? categoryFromCell(values[columns.category]) : null) ?? currentCategory;
    const resourceText = cellText(values[columns.resource]).trim();
    if (!resourceText || !category || isSubtotalRow(resourceText) || isSummaryRow(resourceText)) continue;
    if (!/[a-záéíóúñ]{2}/i.test(resourceText) || headerRole(resourceText) === "resource") continue;

    const quantityCell = columns.quantity === undefined ? undefined : values[columns.quantity];
    const parsedQuantity = parseNumericCell(quantityCell);
    const yieldCell = columns.yieldPerDay === undefined ? undefined : values[columns.yieldPerDay];
    const parsedYield = parseNumericCell(yieldCell);
    const partialCell = columns.partial === undefined ? undefined : values[columns.partial];
    const declaredPartial = parseNumericCell(partialCell);
    const rateCell = columns.rate === undefined ? undefined : values[columns.rate];
    let parsedRate = parseNumericCell(rateCell);
    const quantity = parsedQuantity && parsedQuantity > 0 ? parsedQuantity : 0;
    const yieldPerDay = category === "materials" ? 1 : parsedYield ?? 1;
    if ((parsedRate === null || parsedRate < 0) && declaredPartial !== null && quantity > 0) {
      parsedRate = declaredPartial / (quantity * (category === "materials" ? 1 : yieldPerDay || 1));
    }

    const messages: string[] = [];
    let severity: ImportSeverity = "ok";
    if (parsedQuantity === null || parsedQuantity <= 0) {
      messages.push(cellText(quantityCell) ? `La cantidad "${cellText(quantityCell)}" no es válida` : "La línea llegó sin cantidad");
      severity = "warning";
    }
    if (parsedRate === null || parsedRate < 0) {
      messages.push(cellText(rateCell) ? `La tarifa "${cellText(rateCell)}" no es válida` : "La línea llegó sin tarifa");
      severity = "error";
    }

    const dailyRate = parsedRate && parsedRate >= 0 ? parsedRate : 0;
    const computedPartial = quantity * dailyRate * (category === "materials" ? 1 : yieldPerDay || 1);
    if (declaredPartial !== null && computedPartial > 0) {
      const drift = Math.abs(declaredPartial - computedPartial) / computedPartial;
      if (drift > 0.01) {
        messages.push("El parcial no coincide con cantidad × tarifa; se usará el cálculo del sistema");
        severity = severity === "error" ? "error" : "warning";
      }
    }

    lines.push({
      rowNumber: row.rowNumber,
      category,
      name: resourceText.slice(0, 200),
      unit: columns.unit === undefined ? unit : cellText(values[columns.unit]) || unit,
      quantity,
      yieldPerDay,
      dailyRate,
      partial: computedPartial,
      severity,
      messages,
    });
    if (lines.length >= MAX_LINES_PER_SHEET) break;
  }

  if (!lines.length) return { reason: "No contiene líneas de recursos interpretables" };
  const categoryCounts: Record<ApuCategory, number> = { equipment: 0, materials: 0, labor: 0, transport: 0 };
  for (const line of lines) categoryCounts[line.category] += 1;
  const distinctCategories = Object.values(categoryCounts).filter((count) => count > 0).length;

  return {
    preview: {
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
      sourceFormat,
      confidence: sourceFormat === "rfc" || (sourceFormat === "reference" && distinctCategories >= 2) ? "high" : "medium",
      categoryCounts,
    },
  };
}

export function inspectApuWorkbook(fileBuffer: ArrayBuffer): Promise<ApuWorkbookInspection> {
  return import("exceljs").then(async (module) => {
    const ExcelJS = (module as { default?: unknown }).default ?? module;
    const workbook = new (ExcelJS as typeof import("exceljs")).Workbook();
    await workbook.xlsx.load(fileBuffer);
    if (!workbook.worksheets.length) throw new Error("El archivo no contiene ninguna hoja de cálculo.");
    if (workbook.worksheets.length > MAX_FILE_SHEETS) throw new Error(`El archivo contiene más de ${MAX_FILE_SHEETS} hojas. Divídelo antes de importarlo.`);

    const inspection: ApuWorkbookInspection = { sheets: [], ignoredSheets: [] };
    for (const sheet of workbook.worksheets) {
      const result = parseSheet(sheet);
      if (result.preview) inspection.sheets.push(result.preview);
      else inspection.ignoredSheets.push({ sheetName: sheet.name, reason: result.reason ?? "No se reconoció como APU" });
    }
    return inspection;
  });
}

export async function previewApuWorkbook(fileBuffer: ArrayBuffer): Promise<ApuImportPreview> {
  const inspection = await inspectApuWorkbook(fileBuffer);
  const first = inspection.sheets[0];
  if (!first) throw new Error("No se encontró ninguna hoja con estructura de APU.");
  return first;
}

export function previewToApuLines(preview: ApuImportPreview, excludedRows: ReadonlySet<number>, includeWithoutQuantity: boolean): ApuLine[] {
  return preview.lines
    .filter((line) => !excludedRows.has(line.rowNumber))
    .filter((line) => includeWithoutQuantity || line.quantity > 0)
    .filter((line) => line.severity !== "error")
    .map((line) => ({
      id: `import-${preview.sheetName}-${line.rowNumber}`,
      category: line.category,
      name: line.name,
      quantity: line.quantity > 0 ? line.quantity : 1,
      yieldPerDay: line.yieldPerDay,
      dailyRate: line.dailyRate,
      unit: line.unit || undefined,
    }));
}

export const needsQuantityReview = (preview: ApuImportPreview, excludedRows: ReadonlySet<number>, includeWithoutQuantity: boolean) =>
  includeWithoutQuantity
    ? preview.lines.filter((line) => !excludedRows.has(line.rowNumber) && line.severity !== "error" && line.quantity <= 0)
    : [];

export const previewTotals = (preview: ApuImportPreview, excludedRows: ReadonlySet<number>, includeWithoutQuantity: boolean) => {
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
