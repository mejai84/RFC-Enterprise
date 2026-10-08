"use client";

/**
 * Asistente de importacion de tablas salariales.
 *
 * Los formatos de cada cliente no son homogeneos, asi que el asistente NO interpreta
 * el archivo por su cuenta. El trabajo es de mirar y confirmar:
 *
 *  1. Se elige el archivo y la hoja. Las hojas que parecen informativas se senalan
 *     como sugerencia, pero la persona decide: nunca se descartan solas.
 *  2. Se ve una vista previa de las filas tal como vienen del archivo.
 *  3. Se mapea cada campo de la tabla a una columna del archivo, a mano.
 *  4. Solo entonces se crea la tabla y sus cargos.
 *
 * Los PDF no se interpretan: no tienen celdas y leerlos por posicion es justo donde
 * un salario queda mal cargado sin que nadie lo note. El PDF se deja como documento
 * fuente de referencia y los valores se capturan por el mapeo.
 */

import { useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

type SheetDump = { name: string; rows: string[][]; numericHits: number };

/** Campos que la tabla salarial entiende, en el orden en que se muestran. */
const FIELDS = [
  { key: "code", label: "Código", required: true },
  { key: "name", label: "Cargo o nivel", required: true },
  { key: "level", label: "Nivel", required: false },
  { key: "basic", label: "Salario diario", required: false },
  { key: "transport", label: "Transporte", required: false },
  { key: "food", label: "Alimentación", required: false },
  { key: "nonSalary", label: "No salarial", required: false },
  { key: "total", label: "Total diario", required: false },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type Mapping = Partial<Record<FieldKey, number>>;

const toNumber = (value: string) => {
  const cleaned = String(value ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function LaborRatesImport({
  companyId,
  onDone,
}: {
  companyId: string;
  onDone: (tableId: string) => void;
}) {
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<SheetDump[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [skipHeaderRows, setSkipHeaderRows] = useState(1);
  const [target, setTarget] = useState<"new" | "existing">("new");
  const [existingTableId, setExistingTableId] = useState("");
  const [existingTables, setExistingTables] = useState<Array<{ id: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const sheet = sheets[sheetIndex];

  /** Filas que se tomaran del archivo, segun las filas de encabezado que se indiquen. */
  const dataRows = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.slice(Math.max(0, skipHeaderRows));
  }, [sheet, skipHeaderRows]);

  /** Cuantas filas producirian los cargos que se crearian. */
  const usableRows = useMemo(
    () => dataRows.filter((row) => row.some((cell) => String(cell ?? "").trim() !== "")),
    [dataRows],
  );

  const columnCount = sheet ? Math.max(...sheet.rows.map((row) => row.length), 0) : 0;

  function buildRow(row: string[]) {
    const pick = (field: FieldKey) => {
      const index = mapping[field];
      return index === undefined ? "" : String(row[index] ?? "").trim();
    };
    const basic = toNumber(pick("basic"));
    const transport = toNumber(pick("transport"));
    const food = toNumber(pick("food"));
    const nonSalary = toNumber(pick("nonSalary"));
    const total = toNumber(pick("total")) || basic + transport + food + nonSalary;
    return {
      code: pick("code"),
      name: pick("name"),
      level: pick("level") ? Number(pick("level")) : null,
      daily_basic_salary: basic,
      transport_allowance: transport,
      food_allowance: food,
      non_salary_allowance: nonSalary,
      total_daily_rate: total,
    };
  }

  async function loadTables() {
    const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
    const { data } = await supabase
      .from("labor_rate_tables")
      .select("id, client_name, name, version")
      .eq("company_id", companyId)
      .order("valid_from", { ascending: false });
    setExistingTables(
      ((data ?? []) as Array<{ id: string; client_name: string; name: string; version: string }>).map((t) => ({
        id: t.id,
        label: `${t.client_name || "Uso general"} · ${t.name} · ${t.version}`,
      })),
    );
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    setFileName(file.name);

    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      setError(
        "Solo se leen libros de Excel (.xlsx). Si el documento es un PDF, súbalo como documento fuente de la tabla y capture los valores a mano.",
      );
      return;
    }

    try {
      const excelModule = await import("exceljs");
      const ExcelJS = (excelModule.default ?? excelModule) as typeof import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const dumped: SheetDump[] = workbook.worksheets.map((ws) => {
        const rows: string[][] = [];
        ws.eachRow({ includeEmpty: true }, (row) => {
          const values = row.values as unknown[];
          rows.push(values.slice(1).map((cell) => {
            if (cell === null || cell === undefined) return "";
            if (typeof cell === "object" && "result" in (cell as Record<string, unknown>)) {
              return String((cell as { result: unknown }).result ?? "");
            }
            if (cell instanceof Date) return cell.toISOString().slice(0, 10);
            return String(cell);
          }));
        });
        // Cuenta celdas numericas: una hoja sin numeros suele ser informativa.
        const numericHits = rows
          .flat()
          .filter((cell) => /^-?[\d.,\s]+$/.test(cell.trim()) && /\d/.test(cell)).length;
        return { name: ws.name, rows, numericHits };
      });
      if (!dumped.length) {
        setError("El archivo no tiene hojas para leer.");
        return;
      }
      setSheets(dumped);
      setSheetIndex(0);
      setMapping({});
      setSkipHeaderRows(1);
      await loadTables();
    } catch {
      setError("No se pudo leer el archivo. Verifique que no esté dañado ni protegido con contraseña.");
    }
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!sheet) return;
    const cargos = usableRows.map(buildRow).filter((cargo) => cargo.code && cargo.name);
    if (!cargos.length) {
      setError("Con el mapeo elegido no queda ningún cargo. Revise las columnas y las filas de encabezado.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
      let tableId = existingTableId;

      if (target === "new") {
        const form = new FormData(event.currentTarget);
        const { data, error: tableError } = await supabase
          .from("labor_rate_tables")
          .insert({
            company_id: companyId,
            client_name: String(form.get("client") ?? "").trim(),
            name: String(form.get("name") ?? "").trim(),
            version: String(form.get("version") ?? "").trim(),
            activity_type: String(form.get("activityType") ?? "general"),
            valid_from: String(form.get("validFrom") ?? ""),
            valid_to: String(form.get("validTo") ?? "").trim() || null,
            source_document: fileName,
          })
          .select("id")
          .single();
        if (tableError) throw tableError;
        tableId = (data as { id: string }).id;
      }

      if (!tableId) throw new Error("Seleccione la tabla a la que agregará los cargos.");

      const { count } = await supabase
        .from("labor_rate_entries")
        .select("id", { count: "exact", head: true })
        .eq("labor_rate_table_id", tableId);
      const base = count ?? 0;

      const { error: rowsError } = await supabase.from("labor_rate_entries").insert(
        cargos.map((cargo, index) => ({
          labor_rate_table_id: tableId,
          company_id: companyId,
          code: cargo.code,
          name: cargo.name,
          level: cargo.level,
          daily_basic_salary: cargo.daily_basic_salary,
          transport_allowance: cargo.transport_allowance,
          food_allowance: cargo.food_allowance,
          non_salary_allowance: cargo.non_salary_allowance,
          total_daily_rate: cargo.total_daily_rate,
          sort_order: base + index + 1,
        })),
      );
      if (rowsError) throw rowsError;

      setNotice(`Se importaron ${cargos.length} cargos desde ${fileName}.`);
      setSheets([]);
      setFileName("");
      setMapping({});
      if (fileInput.current) fileInput.current.value = "";
      onDone(tableId);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? `No se pudo importar: ${importError.message}`
          : "No se pudo importar la tabla.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="labor-rate-import" onSubmit={handleImport}>
      <h3>Importar desde Excel</h3>
      <p className="panel-intro">
        El archivo se lee con el mapeo que usted indique. Nada se interpreta solo: revise la vista
        previa antes de guardar.
      </p>

      <label className="labor-rate-import-file">
        Archivo del cliente
        <input ref={fileInput} accept=".xlsx,.xlsm" onChange={(e) => void handleFile(e)} type="file" />
      </label>
      {fileName ? <p className="panel-intro">Archivo leído: <strong>{fileName}</strong></p> : null}
      {error ? <p className="settings-notice" role="alert">{error}</p> : null}
      {notice ? <p className="settings-notice" role="status">{notice}</p> : null}

      {!sheet ? null : (
        <>
          <div className="labor-rate-import-controls">
            <label>
              Hoja del archivo
              <select
                onChange={(e) => { setSheetIndex(Number(e.target.value)); setMapping({}); }}
                value={sheetIndex}
              >
                {sheets.map((item, index) => (
                  <option key={item.name} value={index}>
                    {item.name}
                    {item.numericHits === 0 ? " (sin cifras: parece informativa)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filas de encabezado a omitir
              <input
                min="0"
                onChange={(e) => setSkipHeaderRows(Number(e.target.value) || 0)}
                type="number"
                value={skipHeaderRows}
              />
            </label>
          </div>

          {sheets.length > 1 ? (
            <p className="panel-intro">
              Este archivo trae {sheets.length} hojas. Las que no tengan cifras suelen ser instructivos
              o anexos: compárelas y elija la de la tabla salarial.
            </p>
          ) : null}

          <div className="labor-rate-import-map">
            <h4>Columnas del archivo</h4>
            <div className="labor-rate-import-map-grid">
              {FIELDS.map((field) => (
                <label key={field.key}>
                  {field.label}
                  {field.required ? " *" : ""}
                  <select
                    onChange={(e) =>
                      setMapping((current) => {
                        const next = { ...current };
                        const value = e.target.value === "" ? undefined : Number(e.target.value);
                        if (value === undefined) delete next[field.key];
                        else next[field.key] = value;
                        return next;
                      })
                    }
                    value={mapping[field.key] ?? ""}
                  >
                    <option value="">— no usar —</option>
                    {Array.from({ length: columnCount }, (_, index) => (
                      <option key={index} value={index}>
                        Columna {index + 1}: {sheet.rows[0]?.[index]?.trim() || "(sin título)"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="labor-rate-import-preview">
            <h4>Vista previa de lo que se guardará ({usableRows.length} cargos)</h4>
            <div className="labor-rate-import-table">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cargo o nivel</th>
                    <th>Nivel</th>
                    <th>Salario</th>
                    <th>Transporte</th>
                    <th>Alimentación</th>
                    <th>No salarial</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {usableRows.slice(0, 12).map((row, index) => {
                    const cargo = buildRow(row);
                    return (
                      <tr key={index}>
                        <td>{cargo.code || "—"}</td>
                        <td>{cargo.name || "—"}</td>
                        <td>{cargo.level ?? "—"}</td>
                        <td>{cargo.daily_basic_salary ? cargo.daily_basic_salary.toLocaleString("es-CO") : "—"}</td>
                        <td>{cargo.transport_allowance ? cargo.transport_allowance.toLocaleString("es-CO") : "—"}</td>
                        <td>{cargo.food_allowance ? cargo.food_allowance.toLocaleString("es-CO") : "—"}</td>
                        <td>{cargo.non_salary_allowance ? cargo.non_salary_allowance.toLocaleString("es-CO") : "—"}</td>
                        <td>{cargo.total_daily_rate ? cargo.total_daily_rate.toLocaleString("es-CO") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {usableRows.length > 12 ? <small>Se muestran 12 de {usableRows.length}.</small> : null}
            </div>
          </div>

          <div className="labor-rate-import-target">
            <label>
              <input
                checked={target === "new"}
                name="target"
                onChange={() => setTarget("new")}
                type="radio"
              />
              Crear una tabla nueva
            </label>
            <label>
              <input
                checked={target === "existing"}
                name="target"
                onChange={() => setTarget("existing")}
                type="radio"
              />
              Agregar los cargos a una tabla existente
            </label>
          </div>

          {target === "new" ? (
            <div className="settings-columns">
              <label>Cliente / contrato<input name="client" placeholder="Ej. OCENSA" required /></label>
              <label>Nombre de la tabla<input name="name" placeholder="Ej. Mano de obra de montaje" required /></label>
              <label>Versión<input name="version" placeholder="Ej. 2027" required /></label>
              <label>Tipo de actividad<select name="activityType"><option value="general">General</option><option value="propias">Propias</option><option value="no_propias">No propias</option></select></label>
              <label>Vigente desde<input name="validFrom" type="date" required /></label>
              <label>Vigente hasta (opcional)<input name="validTo" type="date" /></label>
            </div>
          ) : (
            <label className="labor-rate-import-existing">
              Tabla de destino
              <select
                onChange={(e) => setExistingTableId(e.target.value)}
                value={existingTableId}
              >
                <option value="">— elija una tabla —</option>
                {existingTables.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          )}

          <button className="inventory-action" disabled={busy} type="submit">
            {busy ? "Importando…" : "Importar cargos"}
          </button>
        </>
      )}
    </form>
  );
}