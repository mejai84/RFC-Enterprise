"use client";

import type { InventoryMovement, Project } from "../index";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type Props = {
  movement: InventoryMovement | null;
  project?: Project | null;
  onClose: () => void;
};

export function PrintableDispatchVoucher({ movement, project, onClose }: Props) {
  if (!movement) return null;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="voucher-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="voucher-title">
      <div className="voucher-modal-container">
        <div className="voucher-modal-actions no-print">
          <span className="voucher-tag">Formato Oficial Remisión Almacén</span>
          <div className="voucher-btns">
            <button className="btn-print" onClick={handlePrint} type="button">
              🖨️ Imprimir / Guardar PDF
            </button>
            <button className="btn-close-voucher" onClick={onClose} type="button" aria-label="Cerrar">
              ✕
            </button>
          </div>
        </div>

        {/* Remisión Imprimible */}
        <div className="printable-voucher-sheet">
          <header className="voucher-header">
            <div className="voucher-brand">
              <div className="voucher-logo">RFC</div>
              <div>
                <h2>REPRESENTACIONES FIGUEROA CASTRO S.A.S.</h2>
                <small>NIT: 900.123.456-7 · Almacén & Logística de Obras</small>
                <p>Caucasia, Antioquia · PBX: (604) 876-5432</p>
              </div>
            </div>
            <div className="voucher-folio">
              <span className="folio-label">VALE DE SALIDA</span>
              <strong className="folio-number">{movement.reference || "VALE-2026-000"}</strong>
              <small>Fecha: {movement.occurredAt}</small>
            </div>
          </header>

          <section className="voucher-info-grid">
            <div className="info-box">
              <span className="info-label">OBRA / PROYECTO DESTINO:</span>
              <strong>{movement.projectName || project?.name || "Sin obra asignada"}</strong>
              {project && <small>Código: {project.code} · Ubicación: {project.location}</small>}
            </div>
            <div className="info-box">
              <span className="info-label">CLIENTE CONTRATANTE:</span>
              <strong>{project?.client || "Representaciones Figueroa Castro"}</strong>
              <small>Frente de Trabajo Oficial</small>
            </div>
            <div className="info-box">
              <span className="info-label">RESPONSABLE / MAESTRO DE OBRA:</span>
              <strong>{movement.responsible || "Maestro Encargado"}</strong>
              <small>Autorizado por Residencia</small>
            </div>
            <div className="info-box">
              <span className="info-label">TIPO DE DESPACHO:</span>
              <strong className="text-brand">Salida de Almacén Imputada a Obra</strong>
              <small>Estado: Despachado & Contabilizado</small>
            </div>
          </section>

          <table className="voucher-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Código / Descripción del Material</th>
                <th className="text-center">Unidad</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Costo Unit. ($)</th>
                <th className="text-right">Total ($ COP)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>
                  <strong>{movement.productName}</strong>
                  {movement.notes && <div className="item-note">Nota: {movement.notes}</div>}
                </td>
                <td className="text-center">{movement.unit || "unidad"}</td>
                <td className="text-right">{movement.quantity}</td>
                <td className="text-right">{currencyFormatter.format(movement.unitCost)}</td>
                <td className="text-right">
                  <strong>{currencyFormatter.format(movement.totalCost)}</strong>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="text-right">
                  <strong>TOTAL DE COSTO DE INSUMOS VALORIZADO:</strong>
                </td>
                <td className="text-right total-amount">{currencyFormatter.format(movement.totalCost)}</td>
              </tr>
            </tfoot>
          </table>

          {movement.notes && (
            <div className="voucher-notes">
              <strong>Observaciones de entrega:</strong>
              <p>{movement.notes}</p>
            </div>
          )}

          <footer className="voucher-signatures">
            <div className="signature-line">
              <div className="sig-space" />
              <strong>Entregado por (Almacén)</strong>
              <small>Representaciones Figueroa Castro S.A.S.</small>
            </div>
            <div className="signature-line">
              <div className="sig-space" />
              <strong>Recibido a Conformidad en Obra</strong>
              <small>Firma, C.C. y Cargo del Residente</small>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
