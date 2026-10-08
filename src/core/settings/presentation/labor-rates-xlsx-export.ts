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
  id: string;
  code: string;
  name: string;
  level: number | null;
  daily_basic_salary: number;
  transport_allowance: number;
  food_allowance: number;
  non_salary_allowance: number;
  total_daily_rate: number;
};

export type LaborRateRoleExport = {
  code: string;
  name: string;
  labor_rate_entry_id: string;
  receives_hotel: boolean;
  receives_operational_transport: boolean;
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
  roles: ReadonlyArray<LaborRateRoleExport> = [],
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

  const roleSheet = workbook.addWorksheet("Cargos por nivel", { views: [{ state: "frozen", ySplit: 5 }] });
  roleSheet.columns = [
    { header: "Nivel", key: "level", width: 12 },
    { header: "C\u00f3digo del nivel", key: "levelCode", width: 18 },
    { header: "C\u00f3digo del cargo", key: "roleCode", width: 22 },
    { header: "Cargo", key: "name", width: 48 },
    { header: "Vi\u00e1ticos por desplazamiento", key: "travel", width: 34 },
  ];
  roleSheet.mergeCells(1, 1, 1, 5);
  roleSheet.getCell(1, 1).value = `Cargos por nivel \u00b7 ${table.name}`;
  roleSheet.getCell(1, 1).font = { size: 14, bold: true, color: { argb: "FF123121" } };
  roleSheet.mergeCells(2, 1, 2, 5);
  roleSheet.getCell(2, 1).value = "Relaci\u00f3n oficial de cargos con el nivel salarial aplicable. Los vi\u00e1ticos se informan por separado del valor oficial del nivel.";
  roleSheet.getCell(2, 1).font = { size: 10, color: { argb: "FF4A5D51" } };
  roleSheet.addRow([]);
  const roleHeader = roleSheet.addRow({ level: "Nivel", levelCode: "C\u00f3digo del nivel", roleCode: "C\u00f3digo del cargo", name: "Cargo", travel: "Vi\u00e1ticos por desplazamiento" });
  roleHeader.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  roleHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123121" } };
  roleHeader.alignment = { vertical: "middle", wrapText: true };
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  roles.slice().sort((left, right) => {
    const leftLevel = entryById.get(left.labor_rate_entry_id)?.level ?? 0;
    const rightLevel = entryById.get(right.labor_rate_entry_id)?.level ?? 0;
    return leftLevel - rightLevel || left.name.localeCompare(right.name, "es");
  }).forEach((role) => {
    const entry = entryById.get(role.labor_rate_entry_id);
    const travel = role.receives_hotel || role.receives_operational_transport
      ? [role.receives_hotel ? "Hotel" : null, role.receives_operational_transport ? "Transporte operativo" : null].filter(Boolean).join(" y ")
      : "No aplica por defecto";
    roleSheet.addRow({ level: entry?.level ? `Nivel ${entry.level}` : "Sin nivel", levelCode: entry?.code ?? "", roleCode: role.code, name: role.name, travel });
  });
  const firstRoleRow = roleHeader.number + 1;
  const lastRoleRow = roleHeader.number + roles.length;
  if (roles.length) applyBorders(roleSheet, roleHeader.number, lastRoleRow, 5);
  else {
    roleSheet.mergeCells(firstRoleRow, 1, firstRoleRow, 5);
    roleSheet.getCell(firstRoleRow, 1).value = "Esta tabla no tiene cargos asociados todav\u00eda.";
  }

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