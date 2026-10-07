"use client";

import { resolveSignatureForExport } from "@/core/settings/presentation/company-signature";
import {
  apuCategoryMeta,
  apuCostTotal,
  apuProfitAmount,
  apuSellingTotal,
  lineTotal,
  type Apu,
  type ApuCategory,
} from "@/modules/apu";

const categories: ApuCategory[] = ["equipment", "materials", "labor", "transport"];

const GREEN = "FF173D2C";
const HEADER_FILL = "FFF1F5F2";
const TOTAL_FILL = "FFE7EFEA";
const BORDER: import("exceljs").Border = { style: "thin", color: { argb: "FF93AA9D" } };
const HAIR_BORDER: import("exceljs").Border = { style: "hair", color: { argb: "FFC7D2CA" } };

type ExcelJSModule = typeof import("exceljs");
type ExcelWorkbook = import("exceljs").Workbook;
type ExcelSheet = import("exceljs").Worksheet;

const cleanSheetName = (value: string, fallback: string, usedNames: Set<string>) => {
  const base = (value || fallback)
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || fallback;
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate.toLocaleLowerCase("es-CO"))) {
    const discriminator = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - discriminator.length)}${discriminator}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLocaleLowerCase("es-CO"));
  return candidate;
};

const applyBorders = (sheet: ExcelSheet, row: number, columns = 6, style: import("exceljs").Border = HAIR_BORDER) => {
  for (let column = 1; column <= columns; column += 1) {
    sheet.getRow(row).getCell(column).border = { top: style, left: style, bottom: style, right: style };
  }
};

async function loadOfficialSignature(workbook: ExcelWorkbook, signature: { imageUrl: string }): Promise<number | null> {
  try {
    const response = await fetch(signature.imageUrl);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return workbook.addImage({ base64: `data:image/png;base64,${btoa(binary)}`, extension: "png" });
  } catch {
    return null;
  }
}

/** Hoja consolidada equivalente al resumen del libro RFC de referencia. */
function addRfcSummarySheet(workbook: ExcelWorkbook, apus: ReadonlyArray<Apu>, signatureImageId: number | null, signatureText: string) {
  const sheet = workbook.addWorksheet("RESUMEN ACTUALIZADO", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
      printTitlesRow: "1:4",
    },
  });
  sheet.properties.defaultRowHeight = 16;
  sheet.properties.tabColor = { argb: GREEN };
  sheet.columns = [
    { width: 7 },
    { width: 16 },
    { width: 42 },
    { width: 10 },
    { width: 15 },
    { width: 18 },
    { width: 18 },
    { width: 19 },
  ];

  sheet.mergeCells("A1:H1");
  const title = sheet.getCell("A1");
  title.value = "RESUMEN ACTUALIZADO DE APUS";
  title.font = { bold: true, size: 13, color: { argb: GREEN } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 25;

  sheet.mergeCells("A2:H2");
  const subtitle = sheet.getCell("A2");
  subtitle.value = `RFC Enterprise · ${apus.length} actividad(es) · ${new Date().toLocaleDateString("es-CO")}`;
  subtitle.font = { size: 9, color: { argb: GREEN } };
  subtitle.alignment = { horizontal: "center" };

  const headers = ["N°", "CÓDIGO", "ACTIVIDAD", "UND.", "CANT. OBRA", "COSTO DIRECTO", "GANANCIA", "PRECIO DE VENTA"];
  headers.forEach((value, index) => {
    const cell = sheet.getRow(4).getCell(index + 1);
    cell.value = value;
    cell.font = { bold: true, size: 9, color: { argb: GREEN } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: index === 2 ? "left" : "center", vertical: "middle", wrapText: true };
  });
  applyBorders(sheet, 4, 8, BORDER);
  sheet.getRow(4).height = 22;

  apus.forEach((apu, index) => {
    const rowNumber = index + 5;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = apu.code;
    row.getCell(3).value = apu.name;
    row.getCell(4).value = apu.unit;
    row.getCell(5).value = Number(apu.workQuantity) || 0;
    row.getCell(6).value = apuCostTotal(apu);
    row.getCell(7).value = apuProfitAmount(apu);
    row.getCell(8).value = apuSellingTotal(apu);
    for (let column = 1; column <= 8; column += 1) {
      const cell = row.getCell(column);
      cell.font = { size: 9 };
      cell.alignment = { vertical: "middle", wrapText: column === 3 };
    }
    row.getCell(5).numFmt = "#,##0.00";
    for (let column = 6; column <= 8; column += 1) row.getCell(column).numFmt = '"$"#,##0';
    applyBorders(sheet, rowNumber, 8);
  });

  const totalRow = apus.length + 5;
  sheet.mergeCells(`A${totalRow}:E${totalRow}`);
  const totalLabel = sheet.getCell(`A${totalRow}`);
  totalLabel.value = "TOTALES";
  totalLabel.font = { bold: true, size: 10, color: { argb: GREEN } };
  totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
  totalLabel.alignment = { horizontal: "right" };
  for (let column = 6; column <= 8; column += 1) {
    const cell = sheet.getCell(totalRow, column);
    const columnLetter = String.fromCharCode(64 + column);
    cell.value = { formula: `SUM(${columnLetter}5:${columnLetter}${totalRow - 1})` };
    cell.numFmt = '"$"#,##0';
    cell.font = { bold: true, size: 10, color: { argb: GREEN } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
  }
  applyBorders(sheet, totalRow, 8, BORDER);
  if (signatureImageId !== null) {
    const signatureRow = totalRow + 2;
    sheet.addImage(signatureImageId, { tl: { col: 0.4, row: signatureRow - 1 }, ext: { width: 165, height: 48 } });
    sheet.mergeCells(`C${signatureRow}:H${signatureRow + 1}`);
    const signer = sheet.getCell(`C${signatureRow}`);
    signer.value = signatureText;
    signer.font = { bold: true, size: 9, color: { argb: GREEN } };
    signer.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.headerFooter.oddFooter = "&LRFC Enterprise&CResumen de APUs&R&P de &N";
}

/**
 * Escribe una actividad como la plantilla histÃ³rica RFC: una hoja por APU,
 * bloques consecutivos por rubro y cantidad de filas variable en cada bloque.
 */
function addOfficialRfcSheet(workbook: ExcelWorkbook, apu: Apu, sheetName: string, signatureImageId: number | null, signatureText: string) {
  const sheet = workbook.addWorksheet(sheetName, {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
      printTitlesRow: "1:3",
    },
  });
  sheet.properties.defaultRowHeight = 15;
  sheet.columns = [
    { width: 29 },
    { width: 8 },
    { width: 11 },
    { width: 16 },
    { width: 17 },
    { width: 17 },
  ];

  sheet.mergeCells("A1:F1");
  const title = sheet.getCell("A1");
  title.value = apu.name.toLocaleUpperCase("es-CO");
  title.font = { bold: true, size: 11, color: { argb: GREEN } };
  title.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
  sheet.getRow(1).height = 24;

  let current = 2;
  const categorySubtotals: number[] = [];

  for (const category of categories) {
    const lines = apu.lines.filter((line) => line.category === category);
    if (!lines.length) continue;

    const header = sheet.getRow(current);
    const headers = [
      apuCategoryMeta[category].label.toLocaleUpperCase("es-CO"),
      "CANT.",
      category === "materials" ? "" : "REND/DÃA",
      "TARIFA/DÃA",
      "VR. PARCIAL",
      current === 2 ? apu.unit : "",
    ];
    headers.forEach((value, index) => {
      const cell = header.getCell(index + 1);
      cell.value = value;
      cell.font = { bold: true, size: 9, color: { argb: GREEN } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.alignment = { horizontal: index === 0 ? "left" : "center", vertical: "middle", wrapText: true };
    });
    applyBorders(sheet, current, 6, BORDER);
    sheet.getRow(current).height = 20;
    if (current === 2) {
      const quantityRow = sheet.getRow(current + 1);
      quantityRow.getCell(6).value = Number(apu.workQuantity) || 0;
      quantityRow.getCell(6).numFmt = "#,##0.00";
      quantityRow.getCell(6).alignment = { horizontal: "center" };
      quantityRow.getCell(6).font = { size: 9, color: { argb: GREEN } };
      current += 2;
    } else {
      current += 1;
    }

    const firstLine = current;
    for (const line of lines) {
      const row = sheet.getRow(current);
      const factor = category === "materials" ? 1 : Number(line.yieldPerDay) || 1;
      const total = lineTotal(line);
      row.getCell(1).value = line.name;
      row.getCell(2).value = Number(line.quantity) || 0;
      row.getCell(3).value = category === "materials" ? "" : factor;
      row.getCell(4).value = Number(line.dailyRate) || 0;
      row.getCell(5).value = {
        formula: category === "materials" ? `B${current}*D${current}` : `B${current}*C${current}*D${current}`,
        result: total,
      };
      for (let column = 1; column <= 6; column += 1) {
        const cell = row.getCell(column);
        cell.font = { size: 9 };
        cell.alignment = { vertical: "middle", wrapText: column === 1 };
      }
      row.getCell(2).numFmt = "#,##0.00";
      row.getCell(3).numFmt = "#,##0.00";
      row.getCell(4).numFmt = '"$"#,##0';
      row.getCell(5).numFmt = '"$"#,##0';
      applyBorders(sheet, current);
      current += 1;
    }

    const subtotalRow = current;
    sheet.mergeCells(`A${subtotalRow}:E${subtotalRow}`);
    const subtotalLabel = sheet.getCell(`A${subtotalRow}`);
    subtotalLabel.value = `TOTAL ${apuCategoryMeta[category].label.toLocaleUpperCase("es-CO")}`;
    subtotalLabel.font = { bold: true, size: 9, color: { argb: GREEN } };
    subtotalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    subtotalLabel.alignment = { horizontal: "right" };
    const subtotal = sheet.getCell(`F${subtotalRow}`);
    subtotal.value = { formula: `SUM(E${firstLine}:E${current - 1})` };
    subtotal.numFmt = '"$"#,##0';
    subtotal.font = { bold: true, size: 9, color: { argb: GREEN } };
    subtotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    applyBorders(sheet, subtotalRow, 6, BORDER);
    categorySubtotals.push(subtotalRow);
    current += 2;
  }

  const directCostRow = current;
  sheet.mergeCells(`A${directCostRow}:E${directCostRow}`);
  const directCostLabel = sheet.getCell(`A${directCostRow}`);
  directCostLabel.value = "COSTO DIRECTO";
  directCostLabel.font = { bold: true, size: 10, color: { argb: GREEN } };
  directCostLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
  directCostLabel.alignment = { horizontal: "right" };
  const directCost = sheet.getCell(`F${directCostRow}`);
  directCost.value = categorySubtotals.length
    ? { formula: categorySubtotals.map((row) => `F${row}`).join("+") }
    : apuCostTotal(apu);
  directCost.numFmt = '"$"#,##0';
  directCost.font = { bold: true, size: 10, color: { argb: GREEN } };
  directCost.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
  applyBorders(sheet, directCostRow, 6, BORDER);

  const profitRow = directCostRow + 1;
  const sellingRow = directCostRow + 2;
  const unitPriceRow = directCostRow + 3;
  const summaryRows: Array<[number, string, number, boolean]> = [
    [profitRow, "GANANCIA", apuProfitAmount(apu), false],
    [sellingRow, "PRECIO DE VENTA", apuSellingTotal(apu), true],
    [unitPriceRow, "PRECIO UNITARIO", apu.workQuantity > 0 ? apuSellingTotal(apu) / apu.workQuantity : 0, true],
  ];
  for (const [rowNumber, label, value, strong] of summaryRows) {
    sheet.mergeCells(`A${rowNumber}:E${rowNumber}`);
    const labelCell = sheet.getCell(`A${rowNumber}`);
    labelCell.value = label;
    labelCell.font = { bold: strong, size: 9, color: { argb: GREEN } };
    labelCell.alignment = { horizontal: "right" };
    const valueCell = sheet.getCell(`F${rowNumber}`);
    valueCell.value = value;
    valueCell.numFmt = '"$"#,##0';
    valueCell.font = { bold: strong, size: 9, color: { argb: GREEN } };
    if (strong) {
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    }
    applyBorders(sheet, rowNumber, 6, BORDER);
  }

  if (signatureImageId !== null) {
    const signatureRow = unitPriceRow + 2;
    sheet.addImage(signatureImageId, { tl: { col: 0.25, row: signatureRow - 1 }, ext: { width: 155, height: 45 } });
    sheet.mergeCells(`C${signatureRow}:F${signatureRow + 1}`);
    const signer = sheet.getCell(`C${signatureRow}`);
    signer.value = signatureText;
    signer.font = { bold: true, size: 9, color: { argb: GREEN } };
    signer.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }

  sheet.views = [{ state: "frozen", ySplit: 3 }];
  sheet.headerFooter.oddFooter = `&LRFC Enterprise&C${apu.code}&R&P de &N`;
}

/**
 * Descarga el formato oficial RFC. Cada actividad del contexto actual se crea
 * como una hoja independiente para que el archivo pueda volver a importarse.
 */
export async function exportApusToXlsx(apus: ReadonlyArray<Apu>, fileLabel = "APU"): Promise<void> {
  if (!apus.length) throw new Error("No hay actividades APU para exportar.");

  const excelModule = await import("exceljs");
  const ExcelJS = (excelModule.default ?? excelModule) as ExcelJSModule;
  const workbook: ExcelWorkbook = new ExcelJS.Workbook();
  workbook.creator = "RFC Enterprise";
  workbook.company = "Representaciones Figueroa Castro S.A.S.";
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedNames = new Set<string>();
  const signature = await resolveSignatureForExport("apuXlsx");
  const signatureImageId = signature.enabled ? await loadOfficialSignature(workbook, signature) : null;
  const signatureText = `${signature.name}\n${signature.title}`;
  addRfcSummarySheet(workbook, apus, signatureImageId, signatureText);
  usedNames.add("resumen actualizado");
  apus.forEach((apu, index) => {
    const sheetName = cleanSheetName(apu.name, `Actividad ${index + 1}`, usedNames);
    addOfficialRfcSheet(workbook, apu, sheetName, signatureImageId, signatureText);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
