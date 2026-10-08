"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { exportLaborRateTableToXlsx } from "./labor-rates-xlsx-export";
import { LaborRatesImport } from "./labor-rates-import";

type RateTable = { id: string; client_name: string; name: string; version: string; activity_type: string; valid_from: string; valid_to: string | null; source_document: string; is_active: boolean };
const cop = (value: number) => Number(value || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
type RateEntry = { id: string; code: string; name: string; level: number | null; daily_basic_salary: number; transport_allowance: number; food_allowance: number; non_salary_allowance: number; total_daily_rate: number };
type LaborRole = { id: string; code: string; name: string; labor_rate_entry_id: string; receives_hotel: boolean; receives_operational_transport: boolean };
const number = (value: FormDataEntryValue | null) => Number(String(value ?? 0).replace(',', '.')) || 0;

export function LaborRateSettingsPanel({ companyId }: { companyId: string }) {
  const [tables, setTables] = useState<RateTable[]>([]);
  const [selected, setSelected] = useState<RateTable | null>(null);
  const [entries, setEntries] = useState<RateEntry[]>([]);
  const [roles, setRoles] = useState<LaborRole[]>([]);
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
    setSelected(table); setEntries([]); setRoles([]); if (!table) return;
    const [{ data, error: loadError }, { data: roleRows, error: rolesError }] = await Promise.all([
      supabase().from("labor_rate_entries").select("id,code,name,level,daily_basic_salary,transport_allowance,food_allowance,non_salary_allowance,total_daily_rate").eq("labor_rate_table_id", table.id).order("sort_order").order("name"),
      supabase().from("labor_rate_roles").select("id,code,name,labor_rate_entry_id,receives_hotel,receives_operational_transport").eq("labor_rate_table_id", table.id).eq("is_active", true).order("name"),
    ]);
    if (loadError || rolesError) setError(loadError?.message ?? rolesError?.message ?? "No fue posible abrir la tabla salarial.");
    else { setEntries((data ?? []) as RateEntry[]); setRoles((roleRows ?? []) as LaborRole[]); }
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
      await exportLaborRateTableToXlsx(selected, entries, roles);
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
        <article className={`labor-rate-card ${selected?.id === table.id ? "is-selected" : ""} ${isCurrent(table) ? "is-current" : ""}`} key={table.id}>
          <strong>{table.name} · {table.version}</strong>
          <span>{table.client_name || "Uso general"} · {table.valid_from}{table.valid_to ? ` a ${table.valid_to}` : ""}</span>
          {isCurrent(table) ? <em className="labor-rate-badge">Vigente hoy</em> : null}
          <button className="labor-rate-view-button" onClick={() => void loadEntries(table)} type="button">{selected?.id === table.id ? "Detalle abierto" : "Ver detalle"}</button>
        </article>
      ))}
    </div>
    {selected ? <>
      <section className="labor-rate-detail" aria-labelledby="labor-rate-detail-title">
        <div className="labor-rate-entries-heading">
          <div><p className="labor-rate-detail-kicker">Detalle de la tabla vigente</p><h3 className="settings-subheading" id="labor-rate-detail-title">{selected.name} · {selected.version}</h3><p className="panel-intro">{selected.client_name || "Uso general"} · Vigencia {selected.valid_from}{selected.valid_to ? ` a ${selected.valid_to}` : ""}{selected.source_document ? ` · Fuente: ${selected.source_document}` : ""}</p></div>
          <button className="inventory-action" disabled={isExporting || entries.length === 0} onClick={() => void handleExport()} type="button">{isExporting ? "Generando…" : "Exportar a Excel"}</button>
        </div>
        <p className="labor-rate-detail-summary">{entries.length} nivel{entries.length === 1 ? "" : "es"} · {roles.length} puesto{roles.length === 1 ? "" : "s"} registrado{roles.length === 1 ? "" : "s"}. Los valores son los oficiales de la tabla cargada; no se agregan provisiones ni recargos a este total.</p>
        <div className="labor-rate-detail-table-wrap" tabIndex={0} aria-label="Detalle de niveles, cargos y valores de la tabla salarial">
          <table className="labor-rate-detail-table">
            <thead><tr><th>Nivel</th><th>Puestos asociados</th><th>Salario día</th><th>Auxilio de transporte</th><th>Auxilio de alimentación</th><th>Auxilio sin incidencia salarial</th><th>Total día PDF</th></tr></thead>
            <tbody>{entries.map((entry) => {
              const rolesForEntry = roles.filter((role) => role.labor_rate_entry_id === entry.id);
              return <tr key={entry.id}><td><strong>{entry.level ? `Nivel ${entry.level}` : "—"}</strong><small>{entry.code}</small></td><td><strong>{entry.name}</strong>{rolesForEntry.length ? <ul>{rolesForEntry.map((role) => <li key={role.id}>{role.name}{role.receives_hotel || role.receives_operational_transport ? <span>Viáticos por desplazamiento</span> : null}</li>)}</ul> : <small>Sin puestos adicionales registrados</small>}</td><td>{cop(entry.daily_basic_salary)}</td><td>{cop(entry.transport_allowance)}</td><td>{cop(entry.food_allowance)}</td><td>{cop(entry.non_salary_allowance)}</td><td><strong>{cop(entry.total_daily_rate)}</strong></td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
      <details className="labor-rate-add-entry"><summary>Agregar nivel o cargo a esta tabla</summary><form className="labor-rate-entry-form" onSubmit={createEntry}><input name="code" placeholder="Código" required /><input name="name" placeholder="Cargo o nivel" required /><input min="1" name="level" placeholder="Nivel" type="number" /><input min="0" name="basic" placeholder="Salario básico diario" type="number" step="0.01" /><input min="0" name="transport" placeholder="Transporte" type="number" step="0.01" /><input min="0" name="food" placeholder="Alimentación" type="number" step="0.01" /><input min="0" name="nonSalary" placeholder="No salarial" type="number" step="0.01" /><input min="0" name="total" placeholder="Total diario (opcional)" type="number" step="0.01" /><button className="inventory-action" disabled={busy} type="submit">Agregar cargo</button></form></details>
    </> : <p className="panel-intro">Seleccione una tabla para revisar y completar sus cargos.</p>}
    <details className="labor-rate-import-details">
      <summary>Importar una tabla desde Excel</summary>
      <LaborRatesImport companyId={companyId} onDone={(tableId) => void loadEntries(tables.find((t) => t.id === tableId) ?? null)} />
    </details>
  </section>;
}