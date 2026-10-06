"use client";

import {
  apuCategoryMeta,
  apuCostTotal,
  apuProfitAmount,
  apuSellingTotal,
  type Apu,
  type ApuCategory,
} from "@/modules/apu";

const categories: ApuCategory[] = ["equipment", "materials", "labor", "transport"];

const GREEN = "FF173D2C";
const GOLD = "FFC49024";
const HEADER_FILL = "FFEEF3F0";

const col = {
  resource: 34,
  unit: 10,
  qty: 10,
  rend: 11,
  tariff: 16,
  partial: 18,
} as const;

type ExcelJSModule = typeof import("exceljs");
type ExcelWorkbook = import("exceljs").Workbook;

/**
 * Exporta el APU a un libro de Excel que conserva el formato de referencia:
 * anchos de columna, celdas combinadas, estilos, configuración de impresión y
 * totales calculados con fórmula (no valores pegados).
 * Se carga la librería de forma diferida para no engordar el bundle inicial.
 */
export async function exportApuToXlsx(apu: Apu): Promise<void> {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const workbook: ExcelWorkbook = new ExcelJS.Workbook();
  workbook.creator = "RFC Enterprise";
  workbook.company = "Representaciones Figueroa Castro S.A.S.";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("APU", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: "1:6",
    },
  });

  // ── Encabezado institucional ──
  sheet.mergeCells("A1:F1");
  const title = sheet.getCell("A1");
  title.value = "REPRESENTACIONES FIGUEROA CASTRO S.A.S.";
  title.font = { bold: true, size: 14, color: { argb: GREEN } };
  title.alignment = { horizontal: "center" };
  sheet.getRow(1).height = 22;

  sheet.mergeCells("A2:F2");
  sheet.getCell("A2").value = "ANALISIS DE PRECIOS UNITARIOS (APU)";
  sheet.getCell("A2").font = { bold: true, size: 11, color: { argb: GOLD } };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  const metaRows: Array<[string, string, string, string]> = [
    ["Código", apu.code, "Actividad", apu.name],
    ["Unidad", apu.unit, "Cantidad de obra", String(apu.workQuantity)],
    ["Cotización", apu.quoteCode ?? "—", "Obra", apu.projectId ?? "—"],
    ["Revisión", `R${apu.revision ?? 0}`, "Fecha", new Date().toLocaleDateString("es-CO")],
  ];
  metaRows.forEach((row, index) => {
    const excelRow = 3 + index;
    sheet.getCell(`A${excelRow}`).value = row[0];
    sheet.getCell(`A${excelRow}`).font = { bold: true, size: 9, color: { argb: GREEN } };
    sheet.mergeCells(`B${excelRow}:C${excelRow}`);
    sheet.getCell(`B${excelRow}`).value = row[1];
    sheet.getCell(`D${excelRow}`).value = row[2];
    sheet.getCell(`D${excelRow}`).font = { bold: true, size: 9, color: { argb: GREEN } };
    sheet.mergeCells(`E${excelRow}:F${excelRow}`);
    sheet.getCell(`E${excelRow}`).value = row[3];
  });

  sheet.getRow(6).height = 6;

  // ── Cabecera de la tabla ──
  const headerRow = 7;
  sheet.columns = [
    { width: col.resource },
    { width: col.unit },
    { width: col.qty },
    { width: col.rend },
    { width: col.tariff },
    { width: col.partial },
  ];
  const headers = ["RECURSO", "UND", "CANT.", "REND/DÍA", "TARIFA BASE", "Vr. PARCIAL"];
  headers.forEach((text, index) => {
    const cell = sheet.getRow(headerRow).getCell(index + 1);
    cell.value = text;
    cell.font = { bold: true, size: 9, color: { argb: GREEN } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: index === 0 ? "left" : "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  sheet.getRow(headerRow).height = 26;

  // ── Cuerpo: una tabla por rubro ──
  let current = headerRow + 1;
  for (const category of categories) {
    const lines = apu.lines.filter((line) => line.category === category);
    if (!lines.length) continue;

    sheet.mergeCells(`A${current}:F${current}`);
    const groupCell = sheet.getCell(`A${current}`);
    groupCell.value = apuCategoryMeta[category].label.toUpperCase();
    groupCell.font = { bold: true, size: 9, color: { argb: GREEN } };
    groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7FAF8" } };
    current += 1;

    const firstLine = current;
    for (const line of lines) {
      const factor = category === "materials" ? 1 : line.yieldPerDay || 1;
      const row = sheet.getRow(current);
      row.getCell(1).value = line.name;
      row.getCell(2).value = line.unit ?? "";
      row.getCell(3).value = Number(line.quantity) || 0;
      row.getCell(4).value = Number(line.yieldPerDay) || 0;
      row.getCell(5).value = Number(line.dailyRate) || 0;
      // Fórmula real: si el usuario cambia cantidad o tarifa, el parcial se recalcula.
      row.getCell(6).value = {
        formula: `C${current}*E${current}*${category === "materials" ? 1 : `IF(D${current}=0,1,D${current})`}`,
      };
      for (let c = 1; c <= 6; c += 1) {
        const cell = row.getCell(c);
        cell.font = { size: 9 };
        cell.border = {
          top: { style: "hair" },
          left: { style: "hair" },
          bottom: { style: "hair" },
          right: { style: "hair" },
        };
        if (c >= 3) cell.numFmt = "#,##0.00";
        if (c >= 5) cell.numFmt = '"$"#,##0';
        if (c === 6) {
          cell.numFmt = '"$"#,##0';
          cell.font = { size: 9, bold: true };
        }
      }
      row.getCell(1).alignment = { wrapText: true, vertical: "middle" };
      current += 1;
    }

    const lastLine = current - 1;
    sheet.getCell(`A${current}`).value = `Total ${apuCategoryMeta[category].label}`;
    sheet.getCell(`A${current}`).font = { bold: true, size: 9 };
    sheet.mergeCells(`A${current}:E${current}`);
    const subtotal = sheet.getCell(`F${current}`);
    subtotal.value = { formula: `SUM(F${firstLine}:F${lastLine})` };
    subtotal.numFmt = '"$"#,##0';
    subtotal.font = { bold: true, size: 9 };
    subtotal.border = { top: { style: "thin" }, bottom: { style: "double" } };
    current += 2;
  }

  // ── Resumen del análisis ──
  const summaryStart = current;
  sheet.mergeCells(`A${current}:F${current}`);
  sheet.getCell(`A${current}`).value = "RESUMEN DEL ANÁLISIS";
  sheet.getCell(`A${current}`).font = { bold: true, size: 10, color: { argb: GREEN } };
  sheet.getCell(`A${current}`).border = { bottom: { style: "thin" } };
  current += 1;

  const cost = apuCostTotal(apu);
  const profit = apuProfitAmount(apu);
  const selling = apuSellingTotal(apu);
  const unitSelling = apu.workQuantity > 0 ? selling / apu.workQuantity : 0;

  const summaryRows: Array<[string, number, boolean]> = [
    ["Costo directo real", cost, false],
    ["Ganancia estimada", profit, false],
    ["Precio de venta total", selling, true],
    ["Precio unitario de venta", unitSelling, true],
  ];
  summaryRows.forEach(([label, value, strong], index) => {
    const row = current + index;
    sheet.mergeCells(`A${row}:E${row}`);
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`A${row}`).font = { size: 9, bold: strong };
    const cell = sheet.getCell(`F${row}`);
    cell.value = value;
    cell.numFmt = '"$"#,##0';
    cell.font = { size: 9, bold: strong };
    if (strong) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });

  sheet.headerFooter.oddFooter = `&LRepresentaciones Figueroa Castro S.A.S.&C&P de &N&R${new Date().toLocaleDateString("es-CO")}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `APU-${apu.code}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
