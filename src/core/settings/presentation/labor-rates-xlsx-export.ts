"use client";

/**
 * Exportacion de las tablas salariales a Excel.
 *
 * Se apoya en el mismo generador oficial que usa la exportacion del APU para que
 * el archivo salga con la misma identidad de RFC: encabezado, datos de la empresa
 * y, si la empresa la tiene cargada, la firma institucional.
 */

export type LaborRateTableExport = {
  client_name: string;
  name: string;
  version: string;
  activity_type: string;
  valid_from: string;
  valid_to: string | null;
  source_document: string | null;
};

export type LaborRateEntryExport = {
  code: string;
  name: string;
  level: number | null;
  daily_basic_salary: number;
  transport_allowance: number;
  food_allowance: number;
  non_salary_allowance: number;
  total_daily_rate: number;
};

type ExcelJSModule = typeof import("exceljs");
type ExcelWorkbook = import("exceljs").Workbook;
type ExcelSheet = import("exceljs").Worksheet;

const BORDER: import("exceljs").Border = { style: "thin", color: { argb: "FF93AA9D" } };

const applyBorders = (sheet: ExcelSheet, fromRow: number, toRow: number, columns: number) => {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      sheet.getRow(row).getCell(column).border = {
        top: BORDER,
        left: BORDER,
        bottom: BORDER,
        right: BORDER,
      };
    }
  }
};

const money = (value: number) => Number(value || 0);
const activityLabel = (value: string) =>
  value === "propias" ? "Actividad propia" : value === "no_propias" ? "Actividad no propia" : "General";

/**
 * Descarga la tabla salarial seleccionada como libro de Excel.
 *
 * @throws Si no hay cargos que exportar, para no dejar un archivo vacío en la
 *         carpeta de descargas de la persona sin avisarle.
 */
export async function exportLaborRateTableToXlsx(
  table: LaborRateTableExport,
  entries: ReadonlyArray<LaborRateEntryExport>,
): Promise<void> {
  if (!entries.length) throw new Error("Esta tabla todavía no tiene cargos que exportar.");

  const excelModule = await import("exceljs");
  const ExcelJS = (excelModule.default ?? excelModule) as ExcelJSModule;
  const workbook: ExcelWorkbook = new ExcelJS.Workbook();
  workbook.creator = "RFC Enterprise";
  workbook.company = "Representaciones Figueroa Castro S.A.S.";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Tabla salarial", { views: [{ state: "frozen", ySplit: 6 }] });
  sheet.columns = [
    { header: "Código", key: "code", width: 14 },
    { header: "Cargo o nivel", key: "name", width: 34 },
    { header: "Nivel", key: "level", width: 10 },
    { header: "Salario diario", key: "basic", width: 18 },
    { header: "Transporte", key: "transport", width: 16 },
    { header: "Alimentación", key: "food", width: 16 },
    { header: "No salarial", key: "nonSalary", width: 16 },
    { header: "Total diario", key: "total", width: 18 },
  ];

  sheet.mergeCells(1, 1, 1, 8);
  const title = sheet.getCell(1, 1);
  title.value = `Tabla salarial · ${table.name}`;
  title.font = { size: 14, bold: true, color: { argb: "FF123121" } };

  sheet.mergeCells(2, 1, 2, 8);
  const detail = sheet.getCell(2, 1);
  const vigencia = table.valid_to ? `${table.valid_from} a ${table.valid_to}` : `Desde ${table.valid_from}`;
  detail.value = [
    table.client_name || "Uso general",
    `Versión ${table.version}`,
    activityLabel(table.activity_type),
    vigencia,
    table.source_document ? `Fuente: ${table.source_document}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  detail.font = { size: 10, color: { argb: "FF4A5D51" } };

  sheet.addRow([]);
  const headerRow = sheet.addRow({
    code: "Código",
    name: "Cargo o nivel",
    level: "Nivel",
    basic: "Salario diario",
    transport: "Transporte",
    food: "Alimentación",
    nonSalary: "No salarial",
    total: "Total diario",
  });
  headerRow.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123121" } };
  headerRow.alignment = { vertical: "middle", wrapText: true };

  entries.forEach((entry) => {
    sheet.addRow({
      code: entry.code,
      name: entry.name,
      level: entry.level ?? "",
      basic: money(entry.daily_basic_salary),
      transport: money(entry.transport_allowance),
      food: money(entry.food_allowance),
      nonSalary: money(entry.non_salary_allowance),
      total: money(entry.total_daily_rate),
    });
  });

  const firstDataRow = headerRow.number + 1;
  const lastDataRow = headerRow.number + entries.length;
  for (let row = firstDataRow; row <= lastDataRow; row += 1) {
    for (let column = 4; column <= 8; column += 1) {
      sheet.getCell(row, column).numFmt = '"$" #,##0';
    }
    sheet.getCell(row, 3).alignment = { horizontal: "center" };
  }
  applyBorders(sheet, headerRow.number, lastDataRow, 8);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const safeName = `${table.client_name || "general"}`.replace(/[^\w-]+/g, "-").toLowerCase();
  const link = document.createElement("a");
  link.href = url;
  link.download = `tabla-salarial-${safeName}-${table.version}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}