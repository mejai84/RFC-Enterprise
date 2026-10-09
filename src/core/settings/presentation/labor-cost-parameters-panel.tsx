"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import {
  laborCostCalculationBases,
  type LaborCostCalculationBase,
  type LaborCostOperation,
  type LaborCostParameter,
} from "@/shared/labor-cost-parameters";

type ParameterRow = {
  code: string;
  label: string;
  rate: number;
  calculation_base: LaborCostCalculationBase;
  operation: LaborCostOperation;
  divisor: number;
  description: string;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
};

const fromRow = (row: ParameterRow): LaborCostParameter => ({
  code: row.code,
  label: row.label,
  rate: Number(row.rate),
  calculationBase: row.calculation_base,
  operation: row.operation,
  divisor: Number(row.divisor),
  description: row.description,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  updatedAt: row.updated_at,
});

const toRow = (item: LaborCostParameter) => ({
  code: item.code,
  label: item.label.trim(),
  rate: item.rate,
  calculation_base: item.calculationBase,
  operation: item.operation,
  divisor: item.divisor,
  description: item.description.trim(),
  sort_order: item.sortOrder,
  is_active: item.isActive,
});

const emptyNew = (): LaborCostParameter => ({
  code: "",
  label: "",
  rate: 0,
  calculationBase: "salario_transporte",
  operation: "sumar",
  divisor: 1,
  description: "",
  sortOrder: 120,
  isActive: true,
});

const isValid = (item: LaborCostParameter) =>
  /^[a-z][a-z0-9_]*$/.test(item.code) &&
  item.label.trim().length > 0 &&
  Number.isFinite(item.rate) &&
  item.rate >= 0 &&
  item.rate <= 1 &&
  Number.isFinite(item.divisor) &&
  item.divisor > 0;

export function LaborCostParametersPanel() {
  const [items, setItems] = useState<LaborCostParameter[]>([]);
  const [newItem, setNewItem] = useState<LaborCostParameter>(emptyNew);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const db = () => createBrowserClient(supabaseUrl!, supabasePublishableKey!);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await db()
      .from("labor_cost_parameters")
      .select("code,label,rate,calculation_base,operation,divisor,description,sort_order,is_active,updated_at")
      .order("sort_order")
      .order("label");
    if (loadError) setError(loadError.message);
    else setItems(((data ?? []) as ParameterRow[]).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function update(code: string, patch: Partial<LaborCostParameter>) {
    setItems((current) => current.map((item) => item.code === code ? { ...item, ...patch } : item));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const all = [...items, ...(newItem.code || newItem.label ? [newItem] : [])];
    const invalid = all.find((item) => !isValid(item));
    if (invalid) {
      setError("Revise el nombre, codigo, porcentaje (0 a 100) y divisor de cada concepto antes de guardar.");
      return;
    }

    setSaving(true);
    setNotice("");
    setError("");
    const { error: saveError } = await db()
      .from("labor_cost_parameters")
      .upsert(all.map(toRow), { onConflict: "code" });
    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setNewItem(emptyNew());
    await load();
    setSaving(false);
    setNotice("Parametros nacionales guardados. Los costos vigentes se recalcularon en la base de datos.");
  }

  if (loading) return <section className="dashboard-panel settings-card"><p className="panel-intro">Cargando parametros laborales...</p></section>;

  return (
    <form className="dashboard-panel settings-card" onSubmit={save}>
      <div>
        <h2>Parametros nacionales de costo laboral</h2>
        <p className="panel-intro">
          Estos porcentajes son la fuente de calculo para APU y cotizaciones. No son nomina: las cotizaciones ya guardadas conservan su propia copia.
        </p>
      </div>

      {error ? <p className="settings-notice" role="alert">{error}</p> : null}
      {notice ? <p className="settings-notice" role="status">{notice}</p> : null}

      <div className="labor-cost-parameters" aria-label="Porcentajes laborales configurables">
        {items.map((item) => (
          <fieldset className="labor-cost-parameter" key={item.code}>
            <legend>{item.label || item.code}</legend>
            <div className="settings-columns">
              <label>
                Porcentaje
                <input
                  aria-label={`Porcentaje de ${item.label}`}
                  inputMode="decimal"
                  min="0"
                  max="100"
                  onChange={(event) => update(item.code, { rate: Number(event.target.value) / 100 })}
                  step="0.0001"
                  type="number"
                  value={Number((item.rate * 100).toFixed(6))}
                />
              </label>
              <label>
                Se aplica sobre
                <select value={item.calculationBase} onChange={(event) => update(item.code, { calculationBase: event.target.value as LaborCostCalculationBase })}>
                  {laborCostCalculationBases.map((base) => <option disabled={item.operation === "sumar" && base.value === "salario_transporte_mas_extras"} key={base.value} value={base.value}>{base.label}</option>)}
                </select>
              </label>
              <label>
                Efecto
                <select value={item.operation} onChange={(event) => {
                  const operation = event.target.value as LaborCostOperation;
                  update(item.code, { operation, calculationBase: operation === "sumar" && item.calculationBase === "salario_transporte_mas_extras" ? "salario_transporte" : item.calculationBase });
                }}>
                  <option value="sumar">Suma al costo</option>
                  <option value="restar">Resta del subtotal</option>
                </select>
              </label>
              <label>
                Divisor
                <input min="0.0001" onChange={(event) => update(item.code, { divisor: Number(event.target.value) })} step="0.01" type="number" value={item.divisor} />
              </label>
            </div>
            <label>
              Descripcion
              <input onChange={(event) => update(item.code, { description: event.target.value })} value={item.description} />
            </label>
            <label className="settings-toggle">
              <input checked={item.isActive} onChange={(event) => update(item.code, { isActive: event.target.checked })} type="checkbox" />
              <span>Aplicar este concepto en los calculos</span>
            </label>
          </fieldset>
        ))}
      </div>

      <details className="labor-rate-add-entry">
        <summary>Agregar otro porcentaje o aporte</summary>
        <div className="settings-columns">
          <label>Nombre<input onChange={(event) => setNewItem({ ...newItem, label: event.target.value })} value={newItem.label} /></label>
          <label>Codigo interno<input onChange={(event) => setNewItem({ ...newItem, code: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="ej_aporte_nuevo" value={newItem.code} /></label>
          <label>Porcentaje<input inputMode="decimal" max="100" min="0" onChange={(event) => setNewItem({ ...newItem, rate: Number(event.target.value) / 100 })} step="0.0001" type="number" value={Number((newItem.rate * 100).toFixed(6))} /></label>
          <label>Base<select value={newItem.calculationBase} onChange={(event) => setNewItem({ ...newItem, calculationBase: event.target.value as LaborCostCalculationBase })}>{laborCostCalculationBases.map((base) => <option disabled={newItem.operation === "sumar" && base.value === "salario_transporte_mas_extras"} key={base.value} value={base.value}>{base.label}</option>)}</select></label>
          <label>Efecto<select value={newItem.operation} onChange={(event) => {
            const operation = event.target.value as LaborCostOperation;
            setNewItem({ ...newItem, operation, calculationBase: operation === "sumar" && newItem.calculationBase === "salario_transporte_mas_extras" ? "salario_transporte" : newItem.calculationBase });
          }}><option value="sumar">Suma al costo</option><option value="restar">Resta del subtotal</option></select></label>
          <label>Divisor<input min="0.0001" onChange={(event) => setNewItem({ ...newItem, divisor: Number(event.target.value) })} step="0.01" type="number" value={newItem.divisor} /></label>
        </div>
        <label>Descripcion<input onChange={(event) => setNewItem({ ...newItem, description: event.target.value })} value={newItem.description} /></label>
      </details>

      <button className="inventory-action" disabled={saving} type="submit">{saving ? "Guardando..." : "Guardar parametros laborales"}</button>
    </form>
  );
}

