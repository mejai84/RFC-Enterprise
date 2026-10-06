"use client";

import { useMemo, useRef, useState } from "react";
import { apuCategoryMeta, type Apu, type ApuLine } from "@/modules/apu";
import {
  needsQuantityReview,
  previewApuWorkbook,
  previewToApuLines,
  previewTotals,
  type ApuImportPreview,
} from "./apu-xlsx-import";

const formatCOP = (value: number) =>
  value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const categories = ["materials", "equipment", "labor", "transport"] as const;

type Props = {
  onClose: () => void;
  onConfirm: (draft: {
    code: string;
    name: string;
    unit: string;
    workQuantity: number;
    lines: ApuLine[];
    importedCount: number;
  }) => void;
};

/**
 * Importación de un APU desde Excel. Muestra la vista previa antes de escribir:
 * nada llega a la base de datos hasta que el usuario confirma, y las líneas con
 * problemas quedan señaladas con una decisión explícita, nunca descartadas en silencio.
 */
export function ApuImportModal({ onClose, onConfirm }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ApuImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [excludedRows, setExcludedRows] = useState<ReadonlySet<number>>(new Set());
  const [includeWithoutQuantity, setIncludeWithoutQuantity] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () => (preview ? previewTotals(preview, excludedRows, includeWithoutQuantity) : null),
    [preview, excludedRows, includeWithoutQuantity],
  );
  const usableLines = useMemo(
    () => (preview ? previewToApuLines(preview, excludedRows, includeWithoutQuantity) : []),
    [preview, excludedRows, includeWithoutQuantity],
  );
  const willNeedReview = useMemo(
    () => (preview ? needsQuantityReview(preview, excludedRows, includeWithoutQuantity) : []),
    [preview, excludedRows, includeWithoutQuantity],
  );

  async function readFile(file: File) {
    setError(null);
    setPreview(null);
    setExcludedRows(new Set());
    setIsReading(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await previewApuWorkbook(buffer);
      if (result.lines.length === 0) {
        setError("El archivo se leyó pero no contiene ninguna línea de recurso. Revisa que tenga el formato del APU exportado.");
        setIsReading(false);
        return;
      }
      setPreview(result);
      setFileName(file.name);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "No fue posible leer el archivo de Excel.");
    } finally {
      setIsReading(false);
    }
  }

  const withoutQuantity = preview?.lines.filter((line) => line.quantity <= 0 && line.severity !== "error") ?? [];
  const total = totals ? Object.values(totals).reduce((sum, value) => sum + value, 0) : 0;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="apu-import-title">
      <div className="modal-card apu-import-card">
        <div className="modal-header">
          <div>
            <p>Importar desde Excel</p>
            <h3 id="apu-import-title">Cargar un APU en formato RFC</h3>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Cerrar importación" title="Cerrar">
            ✕
          </button>
        </div>

        <div className="apu-import-body">
          <p className="apu-import-hint">
            Sube el archivo exportado por RFC Enterprise, edítalo en Excel y vuelve a subirlo. Se puede agregar
            o quitar líneas de materiales en cada actividad; las cantidades en blanco se señalan aquí antes de
            guardar nada.
          </p>

          <label className="apu-import-drop">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void readFile(file);
              }}
              aria-label="Seleccionar archivo de Excel con el APU"
              title="Seleccionar archivo XLSX"
            />
            <strong>{isReading ? "Leyendo el archivo…" : "Seleccionar archivo .xlsx"}</strong>
            <small>{fileName || "El archivo no se envía a ningún servidor: se lee en tu equipo."}</small>
          </label>

          {error ? (
            <p className="apu-import-error" role="alert">
              {error}
            </p>
          ) : null}

          {preview ? (
            <>
              <dl className="apu-import-meta">
                <div>
                  <dt>Actividad</dt>
                  <dd>{preview.name || "Sin nombre"}</dd>
                </div>
                <div>
                  <dt>Código</dt>
                  <dd>{preview.code || "Se generará uno nuevo"}</dd>
                </div>
                <div>
                  <dt>Unidad</dt>
                  <dd>{preview.unit || "—"}</dd>
                </div>
                <div>
                  <dt>Cantidad de obra</dt>
                  <dd>{preview.workQuantity ? preview.workQuantity.toLocaleString("es-CO") : "No indicada"}</dd>
                </div>
                <div>
                  <dt>Líneas leídas</dt>
                  <dd>{preview.lines.length}</dd>
                </div>
              </dl>

              {withoutQuantity.length > 0 ? (
                <div className="apu-import-ask">
                  <p>
                    <strong>{withoutQuantity.length}</strong> {withoutQuantity.length === 1 ? "línea llegó" : "líneas llegaron"} sin
                    cantidad: {withoutQuantity.slice(0, 4).map((line) => line.name).join(", ")}
                    {withoutQuantity.length > 4 ? "…" : ""}
                  </p>
                  <div className="apu-import-ask-actions">
                    <button
                      type="button"
                      onClick={() => setIncludeWithoutQuantity(false)}
                      aria-pressed={!includeWithoutQuantity}
                      title="No traer estas líneas al APU; se descartan de la importación"
                    >
                      {includeWithoutQuantity ? "Seleccionada" : "Quitarlas del APU"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncludeWithoutQuantity(true)}
                      aria-pressed={includeWithoutQuantity}
                      title="Traerlas con cantidad 1 para que puedas ajustarlas en la actividad"
                    >
                      {includeWithoutQuantity ? "Seleccionada" : "Traerlas con cantidad 1"}
                    </button>
                  </div>
                  <small>
                    {includeWithoutQuantity
                      ? "Entrarán con cantidad 1 y quedaron marcadas en la actividad para que las revises."
                      : "No se descartan del archivo: simplemente no entran a este APU."}
                  </small>
                </div>
              ) : null}

              {preview.skipped.length > 0 ? (
                <p className="apu-import-warning">
                  {preview.skipped.length} fila(s) quedaron fuera de un rubro y no se importaron:{" "}
                  {preview.skipped.slice(0, 3).map((row) => `fila ${row.rowNumber}`).join(", ")}.
                </p>
              ) : null}

              <div className="apu-import-table-wrap">
                <table className="apu-import-table">
                  <caption className="sr-only">Vista previa de las líneas a importar</caption>
                  <thead>
                    <tr>
                      <th scope="col">Recurso</th>
                      <th scope="col">Rubro</th>
                      <th scope="col">Cant.</th>
                      <th scope="col">Rend/Día</th>
                      <th scope="col">Tarifa</th>
                      <th scope="col">Vr. parcial</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Importar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((line) => {
                      const excluded = excludedRows.has(line.rowNumber);
                      return (
                        <tr key={line.rowNumber} className={excluded ? "is-excluded" : `is-${line.severity}`}>
                          <td>
                            <strong>{line.name}</strong>
                            {line.messages.length > 0 ? (
                              <small className="apu-import-note">{line.messages.join(" · ")}</small>
                            ) : null}
                          </td>
                          <td>{apuCategoryMeta[line.category].label}</td>
                          <td>{line.quantity ? line.quantity.toLocaleString("es-CO") : "—"}</td>
                          <td>{line.category === "materials" ? "—" : line.yieldPerDay.toLocaleString("es-CO")}</td>
                          <td>{formatCOP(line.dailyRate)}</td>
                          <td>{formatCOP(line.partial)}</td>
                          <td>
                            <span className={`apu-import-badge is-${line.severity}`}>
                              {line.severity === "error" ? "Con error" : line.severity === "warning" ? "Revisar" : "Correcta"}
                            </span>
                          </td>
                          <td>
                            {line.severity === "error" ? (
                              <small>No se importa</small>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setExcludedRows((current) => {
                                    const next = new Set(current);
                                    if (next.has(line.rowNumber)) next.delete(line.rowNumber);
                                    else next.add(line.rowNumber);
                                    return next;
                                  })
                                }
                                aria-pressed={!excluded}
                                aria-label={`${excluded ? "Incluir" : "Excluir"} ${line.name} de la importación`}
                                title={excluded ? "Incluir esta línea" : "Excluir esta línea"}
                              >
                                {excluded ? "❯ Incluir" : "Excluir"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {willNeedReview.length > 0 ? (
                <p className="apu-import-warning">
                  <strong>{willNeedReview.length}</strong> línea(s) entrarán con cantidad 1 para que puedas ajustarlas:{" "}
                  {willNeedReview.slice(0, 5).map((line) => line.name).join(", ")}
                  {willNeedReview.length > 5 ? "…" : ""}. Revísalas en la actividad antes de guardar.
                </p>
              ) : null}

              <div className="apu-import-totals">
                {categories.map((category) => (
                  <div key={category}>
                    <span>{apuCategoryMeta[category].label}</span>
                    <strong>{formatCOP(totals?.[category] ?? 0)}</strong>
                  </div>
                ))}
                <div className="is-total">
                  <span>Costo directo a importar</span>
                  <strong>{formatCOP(total)}</strong>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="modal-footer apu-import-footer">
          <button type="button" className="apu-import-secondary" onClick={onClose} title="Cancelar la importación">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!preview) return;
              onConfirm({
                code: preview.code,
                name: preview.name,
                unit: preview.unit,
                workQuantity: preview.workQuantity,
                lines: usableLines,
                importedCount: usableLines.length,
              });
            }}
            disabled={!preview || usableLines.length === 0}
            title="Crear la actividad con estas líneas en la base de datos"
          >
            {preview ? `Importar ${usableLines.length} línea(s)` : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}
