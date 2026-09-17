"use client";

import { inventoryProducts, sampleInitialMovements } from "../fixtures";

export function ReportsWorkspace() {
  function exportCsv() {
    const rows = inventoryProducts.map((product) => [product.sku, product.name, product.category, product.location, product.available, product.unit, product.unitCost ?? 0]);
    const csv = "SKU;Artículo;Categoría;Ubicación;Existencia;Unidad;Costo unitario\n" + rows.map((row) => row.join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    link.download = "RFC_inventario.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <main className="dashboard-content report-document"><header className="report-print-header"><img src="/rfc-logo.svg" alt="Logo RFC" /><div><strong>REPRESENTACIONES FIGUEROA CASTRO S.A.S.</strong><small>Informe de inventario</small></div></header><section className="dashboard-heading"><div><p>Dirección · RFC Enterprise</p><h1>Informes</h1><small>Datos de inventario, movimientos, proyectos y operación.</small></div></section><section className="dashboard-panel"><div className="panel-title"><div><p>Exportación</p><h2>Inventario actual</h2></div><div className="row-actions no-print"><button className="inventory-action" onClick={exportCsv} type="button">Exportar Excel (CSV)</button><button className="btn-row-action" onClick={() => window.print()} type="button">PDF / Imprimir</button></div></div><p className="panel-intro">{inventoryProducts.length} artículos · {sampleInitialMovements.length} movimientos disponibles para análisis.</p></section></main>;
}
