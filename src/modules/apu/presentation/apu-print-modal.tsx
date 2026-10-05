"use client";

import {
  apuCategoryMeta,
  apuCostTotal,
  apuEffectiveMarginPercent,
  apuProfitAmount,
  apuSellingTotal,
  lineTotal,
  type Apu,
  type ApuCategory,
} from "@/modules/apu";

const formatCOP = (value: number) =>
  value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const categories: ApuCategory[] = ["equipment", "materials", "labor", "transport"];

export function ApuPrintModal({ apu, onClose }: { apu: Apu; onClose: () => void }) {
  const directCost = apuCostTotal(apu);
  const directUnitCost = directCost / (apu.workQuantity || 1);
  const sellingTotal = apuSellingTotal(apu);
  const sellingUnitCost = sellingTotal / (apu.workQuantity || 1);
  const profit = apuProfitAmount(apu);
  const marginPercent = apuEffectiveMarginPercent(apu);
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="apu-print-overlay" role="dialog" aria-modal="true" aria-label="Vista previa para imprimir APU">
      <div className="apu-print-controls no-print">
        <button type="button" className="inventory-action" onClick={handlePrint}>🖨️ Imprimir / PDF</button>
        <button type="button" className="apu-delete-apu" onClick={onClose}>Cerrar vista previa</button>
      </div>
      <div className="apu-print-sheet" id="apu-print-sheet">
        {/* ─── Encabezado institucional ─── */}
        <header className="apu-print-header">
          <img src="/rfc-logo.svg" alt="RFC Enterprise" className="apu-print-logo" />
          <div className="apu-print-header-info">
            <h1>Análisis de Precio Unitario</h1>
            <p>Representaciones Figueroa &amp; Cía S.A.S.</p>
            <p className="apu-print-date">{dateStr}</p>
          </div>
        </header>

        {/* ─── Datos generales ─── */}
        <section className="apu-print-meta">
          <dl>
            <div><dt>Código</dt><dd>{apu.code}</dd></div>
            <div><dt>Actividad</dt><dd>{apu.name}</dd></div>
            <div><dt>Unidad</dt><dd>{apu.unit}</dd></div>
            <div><dt>Cantidad de obra</dt><dd>{apu.workQuantity.toLocaleString("es-CO")}</dd></div>
            {apu.quoteCode ? <div><dt>Cotización</dt><dd>{apu.quoteCode}</dd></div> : null}
            {apu.revision ? <div><dt>Revisión</dt><dd>v{apu.revision}</dd></div> : null}
          </dl>
        </section>

        {/* ─── Tablas por categoría ─── */}
        {categories.map((category) => {
          const lines = apu.lines.filter((line) => line.category === category);
          const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
          return (
            <section className="apu-print-category" key={category}>
              <h2>{apuCategoryMeta[category].label}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Recurso</th>
                    <th>Unidad</th>
                    <th>Cant.</th>
                    <th>Rend./día</th>
                    <th>Tarifa</th>
                    <th>Parcial</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length ? lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        {line.name}
                        {line.laborCode ? <small> ({line.laborCode} · Nv.{line.laborLevel})</small> : null}
                        {line.transportCode ? <small> ({line.transportCode})</small> : null}
                      </td>
                      <td>{line.unit || "—"}</td>
                      <td>{line.quantity}</td>
                      <td>{line.yieldPerDay}</td>
                      <td>{formatCOP(line.dailyRate)}</td>
                      <td className="apu-print-number">{formatCOP(lineTotal(line))}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="apu-print-empty">Sin recursos asignados</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Subtotal {apuCategoryMeta[category].label}</td>
                    <td className="apu-print-number"><strong>{formatCOP(subtotal)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </section>
          );
        })}

        {/* ─── Resumen de costos y precios ─── */}
        <section className="apu-print-summary">
          <table>
            <tbody>
              <tr><td>Costo directo total</td><td className="apu-print-number">{formatCOP(directCost)}</td></tr>
              <tr><td>Margen / Utilidad estimada (+{marginPercent.toFixed(1)}%)</td><td className="apu-print-number">+{formatCOP(profit)}</td></tr>
              <tr style={{ background: 'var(--brand-soft)', fontWeight: 800 }}>
                <td>Precio de venta cotizado</td>
                <td className="apu-print-number" style={{ color: 'var(--brand-dark)' }}><strong>{formatCOP(sellingTotal)}</strong></td>
              </tr>
              <tr className="apu-print-unit-row">
                <td>Precio unitario de venta ({apu.unit})</td>
                <td className="apu-print-number"><strong>{formatCOP(sellingUnitCost)}</strong></td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ─── Firmas ─── */}
        <footer className="apu-print-signatures">
          <div>
            <div className="apu-print-signature-line" />
            <p>Elaboró</p>
          </div>
          <div>
            <div className="apu-print-signature-line" />
            <p>Revisó</p>
          </div>
          <div>
            <div className="apu-print-signature-line" />
            <p>Aprobó</p>
          </div>
        </footer>
        <footer className="apu-print-bottom-actions no-print">
          <button type="button" className="apu-delete-apu" onClick={onClose}>Cerrar vista previa</button>
        </footer>
      </div>
    </div>
  );
}
