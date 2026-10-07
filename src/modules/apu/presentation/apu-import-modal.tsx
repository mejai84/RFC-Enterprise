"use client";

import { useMemo, useRef, useState } from "react";
import { apuCategoryMeta, type ApuLine } from "@/modules/apu";
import {
  inspectApuWorkbook,
  needsQuantityReview,
  previewToApuLines,
  previewTotals,
  type ApuImportPreview,
  type ApuWorkbookInspection,
} from "./apu-xlsx-import";

const formatCOP = (value: number) =>
  value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const categories = ["materials", "equipment", "labor", "transport"] as const;
const MAX_APU_FILE_SIZE = 20 * 1024 * 1024;

type Props = {
  onClose: () => void;
  onConfirm: (drafts: Array<{
    code: string;
    name: string;
    unit: string;
    workQuantity: number;
    lines: ApuLine[];
    importedCount: number;
  }>) => void;
};

/**
 * Importación de un APU desde Excel. Muestra la vista previa antes de escribir:
 * nada llega a la base de datos hasta que el usuario confirma, y las líneas con
 * problemas quedan señaladas con una decisión explícita, nunca descartadas en silencio.
 */
export function ApuImportModal({ onClose, onConfirm }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inspection, setInspection] = useState<ApuWorkbookInspection | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [selectedSheetNames, setSelectedSheetNames] = useState<ReadonlySet<string>>(new Set());
  const [optionsBySheet, setOptionsBySheet] = useState<Record<string, { excludedRows: ReadonlySet<number>; includeWithoutQuantity: boolean }>>({});
  const [fileName, setFileName] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo<ApuImportPreview | null>(
    () => inspection?.sheets.find((sheet) => sheet.sheetName === selectedSheetName) ?? null,
    [inspection, selectedSheetName],
  );
  const selectedPreviews = useMemo(
    () => inspection?.sheets.filter((sheet) => selectedSheetNames.has(sheet.sheetName)) ?? [],
    [inspection, selectedSheetNames],
  );
  const currentOptions = optionsBySheet[selectedSheetName] ?? { excludedRows: new Set<number>(), includeWithoutQuantity: false };
  const excludedRows = currentOptions.excludedRows;
  const includeWithoutQuantity = currentOptions.includeWithoutQuantity;
  function updateCurrentOptions(update: (current: { excludedRows: ReadonlySet<number>; includeWithoutQuantity: boolean }) => { excludedRows: ReadonlySet<number>; includeWithoutQuantity: boolean }) {
    if (!selectedSheetName) return;
    setOptionsBySheet((current) => ({ ...current, [selectedSheetName]: update(current[selectedSheetName] ?? { excludedRows: new Set<number>(), includeWithoutQuantity: false }) }));
  }

  const totals = useMemo(
    () => (preview ? previewTotals(preview, excludedRows, includeWithoutQuantity) : null),
    [preview, excludedRows, includeWithoutQuantity],
  );
  const willNeedReview = useMemo(
    () => (preview ? needsQuantityReview(preview, excludedRows, includeWithoutQuantity) : []),
    [preview, excludedRows, includeWithoutQuantity],
  );

  async function readFile(file: File) {
    setError(null);
    setInspection(null);
    setSelectedSheetName("");
    setSelectedSheetNames(new Set());
    setOptionsBySheet({});
    setIsReading(true);
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        throw new Error("Selecciona un archivo .xlsx. Los formatos .xls y .csv no conservan la estructura completa del APU.");
      }
      if (file.size <= 0 || file.size > MAX_APU_FILE_SIZE) {
        throw new Error("El archivo debe pesar menos de 20 MB para poder revisarlo de forma segura en el navegador.");
      }
      const buffer = await file.arrayBuffer();
      const signature = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4));
      if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
        throw new Error("El contenido no corresponde a un libro de Excel válido.");
      }
      const result = await inspectApuWorkbook(buffer);
      if (!result.sheets.length) {
        throw new Error("No se encontraron hojas de actividades APU. Las hojas de catálogos, salarios, dotación y resúmenes se excluyen automáticamente.");
      }
      setInspection(result);
      setSelectedSheetName(result.sheets[0].sheetName);
      setSelectedSheetNames(new Set([result.sheets[0].sheetName]));
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
            Puedes usar el formato RFC compartido o el archivo exportado por el sistema. Se reconocen las hojas
            de actividades por sus rubros y columnas, aunque cambie la cantidad de filas; catálogos, dotación,
            salarios y resúmenes quedan fuera de la importación.
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

          {inspection && inspection.sheets.length > 0 ? (
            <section className="apu-import-source" aria-labelledby="apu-import-source-title">
              <div>
                <p id="apu-import-source-title">Actividades detectadas</p>
                <small>
                  {inspection.sheets.length} hoja{inspection.sheets.length === 1 ? "" : "s"} de actividad. Marca una o varias para importar.
                </small>
              </div>
              <div className="apu-import-sheet-picker">
                <div className="apu-import-sheet-picker-header">
                  <span>Hojas de actividad para importar</span>
                  <button type="button" onClick={() => setSelectedSheetNames(new Set(inspection.sheets.map((sheet) => sheet.sheetName)))}>Seleccionar todas</button>
                </div>
                <div className="apu-import-sheet-list">
                  {inspection.sheets.map((sheet) => {
                    const checked = selectedSheetNames.has(sheet.sheetName);
                    const active = sheet.sheetName === selectedSheetName;
                    return <div className={`apu-import-sheet-option ${active ? "is-active" : ""}`} key={sheet.sheetName}>
                      <input id={`apu-sheet-${sheet.sheetName}`} type="checkbox" checked={checked} onChange={(event) => {
                        setSelectedSheetNames((current) => { const next = new Set(current); if (event.target.checked) next.add(sheet.sheetName); else next.delete(sheet.sheetName); return next; });
                        if (event.target.checked) setSelectedSheetName(sheet.sheetName);
                      }} />
                      <label htmlFor={`apu-sheet-${sheet.sheetName}`}><strong>{sheet.name || sheet.sheetName}</strong><small>{sheet.lines.length} recursos · {sheet.sourceFormat === "rfc" ? "Formato RFC" : "Formato compatible"}</small></label>
                      <button type="button" onClick={() => setSelectedSheetName(sheet.sheetName)} aria-pressed={active}>Ver</button>
                    </div>;
                  })}
                </div>
                {inspection.ignoredSheets.length ? <details className="apu-import-ignored-sheets"><summary>{inspection.ignoredSheets.length} hoja(s) informativa(s) no se importarán</summary><ul>{inspection.ignoredSheets.map((sheet) => <li key={sheet.sheetName}><strong>{sheet.sheetName}</strong>: {sheet.reason}</li>)}</ul></details> : null}
              </div>
              {preview ? (
                <span className={`apu-import-format is-${preview.confidence}`}>
                  {preview.sourceFormat === "rfc" ? "Formato RFC Enterprise" : preview.sourceFormat === "reference" ? "Formato de referencia" : "Formato compatible detectado"}
                </span>
              ) : null}
            </section>
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
                <div>
                  <dt>Hoja de origen</dt>
                  <dd>{preview.sheetName}</dd>
                </div>
              </dl>

              <div className="apu-import-detected-groups" aria-label="Recursos detectados por rubro">
                {categories.map((category) => (
                  <span key={category}>
                    {apuCategoryMeta[category].label}: <strong>{preview.categoryCounts[category]}</strong>
                  </span>
                ))}
              </div>

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
                      onClick={() => updateCurrentOptions((current) => ({ ...current, includeWithoutQuantity: false }))}
                      aria-pressed={!includeWithoutQuantity}
                      title="No traer estas líneas al APU; se descartan de la importación"
                    >
                      {includeWithoutQuantity ? "Seleccionada" : "Quitarlas del APU"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrentOptions((current) => ({ ...current, includeWithoutQuantity: true }))}
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
                                  updateCurrentOptions((current) => {
                                    const next = new Set(current.excludedRows);
                                    if (next.has(line.rowNumber)) next.delete(line.rowNumber);
                                    else next.add(line.rowNumber);
                                    return { ...current, excludedRows: next };
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
              if (!selectedPreviews.length) return;
              onConfirm(selectedPreviews.map((sheet) => {
                const options = optionsBySheet[sheet.sheetName] ?? { excludedRows: new Set<number>(), includeWithoutQuantity: false };
                const lines = previewToApuLines(sheet, options.excludedRows, options.includeWithoutQuantity);
                return { code: sheet.code, name: sheet.name, unit: sheet.unit, workQuantity: sheet.workQuantity, lines, importedCount: lines.length };
              }).filter((draft) => draft.lines.length > 0));
            }}
            disabled={!selectedPreviews.length || selectedPreviews.some((sheet) => previewToApuLines(sheet, optionsBySheet[sheet.sheetName]?.excludedRows ?? new Set<number>(), optionsBySheet[sheet.sheetName]?.includeWithoutQuantity ?? false).length === 0)}
            title="Crear las actividades seleccionadas con sus líneas en el APU"
          >
            {selectedPreviews.length ? `Importar ${selectedPreviews.length} actividad${selectedPreviews.length === 1 ? "" : "es"} seleccionada${selectedPreviews.length === 1 ? "" : "s"}` : "Marca actividades para importar"}
          </button>
        </div>
      </div>
    </div>
  );
}
