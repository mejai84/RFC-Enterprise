"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  INVENTORY_IMPORT_MAX_FILE_BYTES,
  buildInventoryImportErrorsCsv,
  buildInventoryImportTemplateCsv,
  parseInventoryCsv,
  parseInventoryMatrix,
  validateInventoryImportRawRows,
  type InventoryImportMatrix,
  type InventoryImportPreview,
  type InventoryImportRawRow,
} from "../domain/inventory-import";
import {
  commitInventoryImport,
  createInventoryImportClient,
  loadInventoryImportContext,
  type InventoryImportCommitResponse,
  type InventoryImportContext,
} from "../data/inventory-import-repository";

const quantityFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 3,
});
const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const groupLabels: Record<string, string> = {
  bodega: "Bodega",
  dotacion: "Dotación",
  trabajadores: "Trabajadores",
};

function downloadText(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function matrixFromWorkbook(file: File): Promise<{
  matrix: string[][];
  notice: string;
}> {
  const excelModule = await import("exceljs");
  const ExcelJS = (excelModule.default ?? excelModule) as typeof import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo no contiene ninguna hoja de cálculo.");

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const value = cell.value;
      let text = "";
      if (value === null || value === undefined) {
        text = "";
      } else if (value instanceof Date) {
        text = value.toISOString().slice(0, 10);
      } else if (typeof value === "object" && "result" in value) {
        text = String((value as { result?: unknown }).result ?? "");
      } else if (typeof value === "object" && "text" in value) {
        text = String((value as { text?: unknown }).text ?? "");
      } else {
        text = cell.text ?? String(value);
      }
      cells[columnNumber - 1] = text;
    });
    for (let index = 0; index < cells.length; index += 1) {
      if (cells[index] === undefined) cells[index] = "";
    }
    matrix[rowNumber - 1] = cells;
  });
  for (let index = 0; index < matrix.length; index += 1) {
    if (!matrix[index]) matrix[index] = [];
  }

  return {
    matrix,
    notice:
      workbook.worksheets.length > 1
        ? "El archivo tiene varias hojas. Se importará únicamente la primera."
        : "",
  };
}

type FileMeta = Pick<
  InventoryImportMatrix,
  "fileError" | "ignoredColumns" | "missingOptionalColumns" | "hasUnitCostColumn"
>;

export function InventoryImportWorkspace() {
  const supabase = useMemo(() => createInventoryImportClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [context, setContext] = useState<InventoryImportContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [contextLoading, setContextLoading] = useState(true);
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<InventoryImportRawRow[]>([]);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [parseNotice, setParseNotice] = useState("");
  const [parseError, setParseError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [commitResult, setCommitResult] =
    useState<InventoryImportCommitResponse | null>(null);
  const [commitError, setCommitError] = useState("");

  const refreshContext = useCallback(async () => {
    await Promise.resolve();
    if (!supabase) {
      setContextError("Supabase no está configurado en este entorno.");
      setContextLoading(false);
      return;
    }
    setContextLoading(true);
    setContextError("");
    const result = await loadInventoryImportContext(supabase);
    if (result.error || !result.context) {
      setContext(null);
      setContextError(result.error || "No fue posible cargar tu contexto de inventario.");
    } else {
      setContext(result.context);
    }
    setContextLoading(false);
  }, [supabase]);

  // El contexto se carga desde Supabase al montar la pantalla. El setState se
  // ejecuta dentro de la promesa; se desactiva la regla para este efecto de
  // sincronización externa.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshContext();
  }, [refreshContext]);

  const preview = useMemo<InventoryImportPreview | null>(() => {
    if (!context || !fileMeta) return null;
    return validateInventoryImportRawRows(rawRows, {
      existingSkus: context.existingSkus,
      fileError: fileMeta.fileError,
      ignoredColumns: fileMeta.ignoredColumns,
      missingOptionalColumns: fileMeta.missingOptionalColumns,
      hasUnitCostColumn: fileMeta.hasUnitCostColumn,
    });
  }, [context, fileMeta, rawRows]);

  const canConfirm = Boolean(
    context &&
      preview &&
      !preview.fileError &&
      preview.valid > 0 &&
      confirmChecked &&
      !isConfirming &&
      !commitResult,
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setParseError("");
    setParseNotice("");
    setCommitResult(null);
    setCommitError("");
    setConfirmChecked(false);
    setRawRows([]);
    setFileMeta(null);
    setFileName(file.name);

    if (file.size > INVENTORY_IMPORT_MAX_FILE_BYTES) {
      setParseError(
        `El archivo supera el límite de ${Math.round(
          INVENTORY_IMPORT_MAX_FILE_BYTES / 1024 / 1024,
        )} MB.`,
      );
      event.target.value = "";
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["csv", "xlsx"].includes(extension)) {
      setParseError("Usa un archivo CSV o XLSX.");
      event.target.value = "";
      return;
    }

    setIsParsing(true);
    try {
      let matrix: string[][];
      let notice = "";
      if (extension === "csv") {
        matrix = parseInventoryCsv(await file.text());
      } else {
        const workbookResult = await matrixFromWorkbook(file);
        matrix = workbookResult.matrix;
        notice = workbookResult.notice;
      }
      const parsed = parseInventoryMatrix(matrix);
      setRawRows(parsed.rawRows);
      setFileMeta({
        fileError: parsed.fileError,
        ignoredColumns: parsed.ignoredColumns,
        missingOptionalColumns: parsed.missingOptionalColumns,
        hasUnitCostColumn: parsed.hasUnitCostColumn,
      });
      setParseNotice(notice);
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : "No fue posible leer el archivo. Verifica que sea un CSV o XLSX válido.",
      );
      event.target.value = "";
    } finally {
      setIsParsing(false);
    }
  }

  async function handleConfirm() {
    if (!supabase || !context || !preview || !canConfirm) return;
    setIsConfirming(true);
    setCommitError("");
    const result = await commitInventoryImport(supabase, {
      context,
      fileName: fileName || "importacion.csv",
      rows: rawRows,
    });
    if (result.response) setCommitResult(result.response);
    if (result.error) setCommitError(result.error);
    setConfirmChecked(false);
    setIsConfirming(false);
  }

  function resetImport() {
    setFileName("");
    setRawRows([]);
    setFileMeta(null);
    setParseNotice("");
    setParseError("");
    setCommitResult(null);
    setCommitError("");
    setConfirmChecked(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    void refreshContext();
  }

  const errorRows = preview?.rows.filter((row) => row.errors.length) ?? [];

  return (
    <main className="dashboard-content inventory-import-page" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Inventarios · RFC Enterprise</p>
          <h1>Importación masiva de inventario</h1>
          <small>
            Carga un CSV o XLSX, revisa la validación y confirma las altas. La
            importación usa Supabase y registra auditoría; no guarda datos en el
            navegador.
          </small>
        </div>
        <div className="header-actions">
          <Link className="inventory-action secondary" href="/inventory">
            Volver al inventario
          </Link>
        </div>
      </section>

      <section className="inventory-import-grid">
        <article className="dashboard-panel inventory-import-panel">
          <div className="panel-title">
            <div>
              <p>Paso 1</p>
              <h2>Archivo y sede</h2>
            </div>
            {context ? (
              <span className="inventory-import-scope">
                {context.companyName ?? "Empresa"} · {context.branchName ?? "Sede"}
              </span>
            ) : null}
          </div>

          {contextLoading ? (
            <p className="panel-intro">Cargando el alcance de inventario…</p>
          ) : contextError ? (
            <div className="inventory-import-alert" role="alert">
              {contextError}
            </div>
          ) : (
            <>
              <p className="panel-intro">
                La importación crea artículos nuevos con su existencia de
                apertura. No actualiza artículos existentes. Los SKU se comparan
                sin distinguir mayúsculas.
              </p>
              <p className="inventory-import-hint">
                En Excel, formatea la columna SKU como texto para conservar ceros
                a la izquierda. Usa la plantilla para mantener los encabezados y
                evita fusionar celdas.
              </p>
              <label className="inventory-import-drop">
                <span>Selecciona un archivo CSV o XLSX</span>
                <small>Máximo 500 filas y 2 MB por archivo.</small>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => void handleFile(event)}
                  disabled={isParsing || isConfirming}
                />
              </label>
              {fileName ? (
                <p className="inventory-import-file">
                  Archivo: <strong>{fileName}</strong>
                  {isParsing ? " · Leyendo…" : ""}
                </p>
              ) : null}
              <div className="inventory-import-tools">
                <button
                  className="inventory-action secondary"
                  type="button"
                  onClick={() =>
                    downloadText(
                      buildInventoryImportTemplateCsv(),
                      "plantilla-importacion-inventario.csv",
                    )
                  }
                >
                  Descargar plantilla CSV
                </button>
                <button
                  className="inventory-action secondary"
                  type="button"
                  onClick={() => void refreshContext()}
                  disabled={contextLoading || isConfirming}
                >
                  Actualizar catálogo
                </button>
              </div>
              {parseError ? (
                <div className="inventory-import-alert" role="alert">
                  {parseError}
                </div>
              ) : null}
              {parseNotice ? (
                <p className="inventory-import-hint">{parseNotice}</p>
              ) : null}
            </>
          )}
        </article>

        <article className="dashboard-panel inventory-import-panel">
          <div className="panel-title">
            <div>
              <p>Paso 2</p>
              <h2>Validación previa</h2>
            </div>
          </div>
          {!preview ? (
            <p className="panel-intro">
              Selecciona un archivo para ver el resumen, las filas válidas y los
              errores que deben corregirse.
            </p>
          ) : (
            <>
              <div className="inventory-import-summary">
                <div><span>Filas</span><strong>{preview.total}</strong></div>
                <div><span>Válidas</span><strong>{preview.valid}</strong></div>
                <div><span>Con error</span><strong>{preview.invalid}</strong></div>
                <div><span>SKU existentes</span><strong>{preview.existingSkuRows}</strong></div>
              </div>
              {preview.fileError ? (
                <div className="inventory-import-alert" role="alert">
                  {preview.fileError}
                </div>
              ) : null}
              {preview.duplicateSkuRows ? (
                <p className="inventory-import-hint">
                  Hay {preview.duplicateSkuRows} filas con SKU repetido dentro del
                  archivo. Se marcan todas para que conserves solo una.
                </p>
              ) : null}
              {!preview.hasUnitCostColumn ? (
                <p className="inventory-import-hint">
                  No se detectó costo unitario. Las filas se crearán con costo 0 y
                  valoración pendiente.
                </p>
              ) : null}
              {preview.missingOptionalColumns.length ? (
                <p className="inventory-import-hint">
                  Columnas opcionales no detectadas:{" "}
                  {preview.missingOptionalColumns.join(", ")}.
                </p>
              ) : null}
              {preview.ignoredColumns.length ? (
                <p className="inventory-import-hint">
                  Columnas ignoradas: {preview.ignoredColumns.slice(0, 12).join(", ")}
                  {preview.ignoredColumns.length > 12 ? "…" : ""}.
                </p>
              ) : null}
              {errorRows.length ? (
                <button
                  className="inventory-action secondary"
                  type="button"
                  onClick={() =>
                    downloadText(
                      buildInventoryImportErrorsCsv(errorRows),
                      "errores-importacion-inventario.csv",
                    )
                  }
                >
                  Descargar errores CSV ({errorRows.length})
                </button>
              ) : null}
            </>
          )}
        </article>
      </section>

      {preview && !preview.fileError && preview.rows.length ? (
        <section className="dashboard-panel inventory-import-preview">
          <div className="panel-title">
            <div>
              <p>Paso 3</p>
              <h2>Vista previa de filas</h2>
            </div>
            <span className="inventory-import-scope">
              {preview.valid} lista{preview.valid === 1 ? "" : "s"} para importar
            </span>
          </div>
          <div className="inventory-import-table-wrap">
            <table className="inventory-import-table">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Grupo</th>
                  <th>Ubicación</th>
                  <th>Cantidad</th>
                  <th>Costo unitario</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={`${row.rowNumber}-${row.sku}`}
                    className={row.errors.length ? "is-error" : "is-valid"}
                  >
                    <td>{row.rowNumber}</td>
                    <td>{row.sku || "—"}</td>
                    <td>{row.name || "—"}</td>
                    <td>{groupLabels[row.inventoryGroup] ?? row.inventoryGroup}</td>
                    <td>{row.location ?? "—"}</td>
                    <td>{quantityFormatter.format(row.quantity)} {row.unit}</td>
                    <td>{currencyFormatter.format(row.unitCost)}</td>
                    <td>
                      {row.errors.length ? (
                        <span className="inventory-import-row-error">
                          {row.errors.join(" ")}
                        </span>
                      ) : (
                        <span className="inventory-import-ok">Válida</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="inventory-import-confirm">
            <label>
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(event) => setConfirmChecked(event.target.checked)}
                disabled={!preview.valid || Boolean(commitResult)}
              />
              <span>
                Revisé las filas y confirmo la creación de {preview.valid}{" "}
                artículo{preview.valid === 1 ? "" : "s"} nuevo
                {preview.valid === 1 ? "" : "s"} con su existencia de apertura.
                {preview.invalid
                  ? ` Las ${preview.invalid} filas con error no se importarán.`
                  : ""}
              </span>
            </label>
            <button
              className="inventory-action"
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canConfirm}
            >
              {isConfirming
                ? "Importando…"
                : `Confirmar importación (${preview.valid})`}
            </button>
          </div>
          {commitError ? (
            <div className="inventory-import-alert" role="alert">
              {commitError}
            </div>
          ) : null}
        </section>
      ) : null}

      {commitResult ? (
        <section className="dashboard-panel inventory-import-result" aria-live="polite">
          <div className="panel-title">
            <div>
              <p>Resultado</p>
              <h2>
                {commitResult.created
                  ? `${commitResult.created} artículo${
                      commitResult.created === 1 ? "" : "s"
                    } creado${commitResult.created === 1 ? "" : "s"}`
                  : "Importación sin altas"}
              </h2>
            </div>
          </div>
          <div className="inventory-import-summary">
            <div><span>Total</span><strong>{commitResult.total ?? 0}</strong></div>
            <div><span>Creados</span><strong>{commitResult.created ?? 0}</strong></div>
            <div><span>Fallidos</span><strong>{commitResult.failed ?? 0}</strong></div>
            <div><span>Lote</span><strong className="inventory-import-batch">{commitResult.batchId?.slice(0, 8) ?? "—"}</strong></div>
          </div>
          {commitResult.auditWarning ? (
            <div className="inventory-import-alert" role="alert">
              {commitResult.auditWarning}
            </div>
          ) : null}
          {commitResult.failures?.length ? (
            <div className="inventory-import-errors">
              <h3>Fallos de escritura</h3>
              <ul>
                {commitResult.failures.map((failure) => (
                  <li key={`${failure.rowNumber}-${failure.sku}`}>
                    Fila {failure.rowNumber} · {failure.sku || "Sin SKU"}:{" "}
                    {failure.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {commitResult.validationErrors?.length ? (
            <div className="inventory-import-errors">
              <h3>Filas omitidas por validación del servidor</h3>
              <ul>
                {commitResult.validationErrors.map((failure) => (
                  <li key={`${failure.rowNumber}-${failure.sku}`}>
                    Fila {failure.rowNumber} · {failure.sku || "Sin SKU"}:{" "}
                    {failure.errors.join(" ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="inventory-import-tools">
            <button
              className="inventory-action secondary"
              type="button"
              onClick={resetImport}
            >
              Importar otro archivo
            </button>
            <Link className="inventory-action" href="/inventory">
              Ver inventario
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
