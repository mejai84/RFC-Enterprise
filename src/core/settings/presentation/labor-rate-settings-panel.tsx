"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { exportLaborRateTableToXlsx } from "./labor-rates-xlsx-export";

type RateTable = { id: string; client_name: string; name: string; version: string; activity_type: string; valid_from: string; valid_to: string | null; source_document: string; is_active: boolean };
type RateEntry = { id: string; code: string; name: string; level: number | null; daily_basic_salary: number; transport_allowance: number; food_allowance: number; non_salary_allowance: number; total_daily_rate: number };
const number = (value: FormDataEntryValue | null) => Number(String(value ?? 0).replace(',', '.')) || 0;

export function LaborRateSettingsPanel({ companyId }: { companyId: string }) {
  const [tables, setTables] = useState<RateTable[]>([]);
  const [selected, setSelected] = useState<RateTable | null>(null);
  const [entries, setEntries] = useState<RateEntry[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [yearFilter, setYearFilter] = useState("all");
  /** Año de cada tabla, tomado del inicio de su vigencia. */
  const yearOf = (table: RateTable) => String(table.valid_from ?? "").slice(0, 4);
  const years = useMemo(
    () => Array.from(new Set(tables.map(yearOf).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [tables],
  );
  /**
   * Vigente = su periodo de vigencia cubre el día de hoy y sigue activa.
   * No se usa la más usada ni la más reciente: es la que realmente aplica hoy.
   */
  const isCurrent = (table: RateTable) => {
    if (!table.is_active) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (table.valid_from && table.valid_from > today) return false;
    if (table.valid_to && table.valid_to < today) return false;
    return true;
  };
  const visibleTables = yearFilter === "all" ? tables : tables.filter((table) => yearOf(table) === yearFilter);
  const supabase = () => createBrowserClient(supabaseUrl!, supabasePublishableKey!);
  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase().from("labor_rate_tables").select("id,client_name,name,version,activity_type,valid_from,valid_to,source_document,is_active").eq("company_id", companyId).order("valid_from", { ascending: false });
    if (loadError) { setError(loadError.message); return; }
    setTables((data ?? []) as RateTable[]);
  }, [companyId]);
  const loadEntries = useCallback(async (table: RateTable | null) => {
    setSelected(table); setEntries([]); if (!table) return;
    const { data, error: loadError } = await supabase().from("labor_rate_entries").select("id,code,name,level,daily_basic_salary,transport_allowance,food_allowance,non_salary_allowance,total_daily_rate").eq("labor_rate_table_id", table.id).order("sort_order").order("name");
    if (loadError) setError(loadError.message); else setEntries((data ?? []) as RateEntry[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const { data, error: saveError } = await supabase().from("labor_rate_tables").insert({ company_id: companyId, client_name: String(form.get("client") ?? "").trim(), name: String(form.get("name") ?? "").trim(), version: String(form.get("version") ?? "").trim(), activity_type: String(form.get("activityType") ?? "general"), valid_from: String(form.get("validFrom") ?? ""), valid_to: String(form.get("validTo") ?? "").trim() || null, source_document: String(form.get("source") ?? "").trim() }).select("id,client_name,name,version,activity_type,valid_from,valid_to,source_document,is_active").single();
    setBusy(false); if (saveError) { setError(saveError.message); return; }
    event.currentTarget.reset(); setNotice("Tabla salarial creada. Ahora puede agregar sus cargos o niveles."); await load(); await loadEntries(data as RateTable);
  }
  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; setBusy(true); setError("");
    const form = new FormData(event.currentTarget); const basic = number(form.get("basic")); const transport = number(form.get("transport")); const food = number(form.get("food")); const nonSalary = number(form.get("nonSalary")); const total = number(form.get("total")) || basic + transport + food + nonSalary;
    const { error: saveError } = await supabase().from("labor_rate_entries").insert({ labor_rate_table_id: selected.id, company_id: companyId, code: String(form.get("code") ?? "").trim(), name: String(form.get("name") ?? "").trim(), level: number(form.get("level")) || null, daily_basic_salary: basic, transport_allowance: transport, food_allowance: food, non_salary_allowance: nonSalary, total_daily_rate: total, sort_order: entries.length + 1 });
    setBusy(false); if (saveError) { setError(saveError.message); return; }
    event.currentTarget.reset(); setNotice("Cargo agregado a la tabla."); await loadEntries(selected);
  }
  async function handleExport() {
    if (!selected || isExporting) return;
    setIsExporting(true); setError(""); setNotice("");
    try {
      await exportLaborRateTableToXlsx(selected, entries);
      setNotice(`Archivo Excel de ${selected.name} descargado.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "No fue posible generar el archivo.");
    } finally {
      setIsExporting(false);
    }
  }
  return <section className="dashboard-panel settings-card labor-rates-settings">
    <div><h2>Costos y tablas salariales</h2><p className="panel-intro">Administre versiones por cliente y vigencia. Las cotizaciones guardan una copia de la tabla elegida; no cambian si actualiza valores después.</p></div>
    {error ? <p className="settings-notice" role="alert">{error}</p> : null}{notice ? <p className="settings-notice" role="status">{notice}</p> : null}
    <form className="settings-columns" onSubmit={createTable}>
      <label>Cliente / contrato<input name="client" placeholder="Ej. OCENSA" required /></label><label>Nombre de la tabla<input name="name" placeholder="Ej. Mano de obra de montaje" required /></label><label>Versión<input name="version" placeholder="Ej. 2027" required /></label><label>Tipo de actividad<select name="activityType"><option value="general">General</option><option value="propias">Propias</option><option value="no_propias">No propias</option></select></label><label>Vigente desde<input name="validFrom" type="date" required /></label><label>Vigente hasta (opcional)<input name="validTo" type="date" /></label><label>Documento fuente<input name="source" placeholder="Nombre del archivo o acta" /></label><button className="inventory-action" disabled={busy} type="submit">{busy ? "Guardando…" : "Crear tabla"}</button>
    </form>
    <div className="labor-rate-years">
      <label>Consultar por año
        <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
          <option value="all">Todos los años</option>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      {tables.some(isCurrent) ? null : <p className="panel-intro">Ninguna tabla cubre la fecha de hoy.</p>}
    </div>
    <div className="labor-rate-list" aria-label="Tablas salariales registradas">
      {visibleTables.length === 0 ? <p className="panel-intro">No hay tablas para ese año.</p> : visibleTables.map((table) => (
        <button className={`labor-rate-card ${selected?.id === table.id ? "is-selected" : ""} ${isCurrent(table) ? "is-current" : ""}`} key={table.id} onClick={() => void loadEntries(table)} type="button">
          <strong>{table.name} · {table.version}</strong>
          <span>{table.client_name || "Uso general"} · {table.valid_from}{table.valid_to ? ` a ${table.valid_to}` : ""}</span>
          {isCurrent(table) ? <em className="labor-rate-badge">Vigente hoy</em> : null}
        </button>
      ))}
    </div>
    {selected ? <><div className="labor-rate-entries-heading"><h3 className="settings-subheading">Cargos de {selected.name}</h3><button className="inventory-action" disabled={isExporting || entries.length === 0} onClick={() => void handleExport()} type="button">{isExporting ? "Generando…" : "Exportar a Excel"}</button></div><form className="labor-rate-entry-form" onSubmit={createEntry}><input name="code" placeholder="Código" required /><input name="name" placeholder="Cargo o nivel" required /><input min="1" name="level" placeholder="Nivel" type="number" /><input min="0" name="basic" placeholder="Salario básico diario" type="number" step="0.01" /><input min="0" name="transport" placeholder="Transporte" type="number" step="0.01" /><input min="0" name="food" placeholder="Alimentación" type="number" step="0.01" /><input min="0" name="nonSalary" placeholder="No salarial" type="number" step="0.01" /><input min="0" name="total" placeholder="Total diario (opcional)" type="number" step="0.01" /><button className="inventory-action" disabled={busy} type="submit">Agregar cargo</button></form><div className="labor-rate-entry-list">{entries.map((entry) => <div key={entry.id}><strong>{entry.code} · {entry.name}</strong><span>${Number(entry.total_daily_rate).toLocaleString("es-CO")} / día</span></div>)}</div></> : <p className="panel-intro">Seleccione una tabla para revisar y completar sus cargos.</p>}
  </section>;
}