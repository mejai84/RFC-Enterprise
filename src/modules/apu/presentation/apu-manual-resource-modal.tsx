"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apuCategoryMeta, type ApuCategory } from "@/modules/apu";

export type ManualResource = {
  name: string;
  unit: string;
  quantity: string;
  yieldPerDay: string;
  dailyRate: string;
};

type Props = {
  category: ApuCategory;
  /** Texto que el usuario ya había escrito en el buscador: se propone como nombre. */
  initialQuery?: string;
  onClose: () => void;
  onAccept: (values: ManualResource) => void;
};

const unitsFor = (category: ApuCategory): string[] => {
  if (category === "labor") return ["día", "jornada", "mes", "hora"];
  if (category === "transport") return ["viaje", "día", "flete", "m³", "km"];
  return ["unidad", "kg", "m³", "m²", "ml", "bulto", "saco", "litro"];
};

/**
 * Alta manual de un recurso que no existe en el catálogo. Se pide el nombre y la
 * tarifa, y opcionalmente la unidad, la cantidad y el rendimiento diario, para que
 * la línea quede completa desde el primer momento y no haya que corregirla después.
 */
export function ApuManualResourceModal({ category, initialQuery, onClose, onAccept }: Props) {
  const suggested = (initialQuery ?? "").trim();
  const [values, setValues] = useState<ManualResource>({
    name: suggested,
    unit: unitsFor(category)[0],
    quantity: "1",
    yieldPerDay: category === "materials" ? "1" : "",
    dailyRate: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta = apuCategoryMeta[category];
  const rateLabel = category === "labor" ? "Salario diario" : category === "transport" ? "Tarifa por viaje o día" : "Tarifa unitaria";

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = values.name.trim();
    if (name.length < 2) {
      setError("Escribe el nombre del recurso.");
      return;
    }
    const rate = Number(values.dailyRate.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (!Number.isFinite(rate) || rate < 0) {
      setError("La tarifa debe ser un número mayor o igual a cero.");
      return;
    }
    onAccept({ ...values, name });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="apu-manual-title">
      <div className="modal-card apu-manual-card">
        <div className="modal-header">
          <div>
            <p>{meta.label}</p>
            <h3 id="apu-manual-title">Agregar recurso que no está en el catálogo</h3>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Cerrar" title="Cerrar">
            ✕
          </button>
        </div>

        <form className="apu-new-form-body" onSubmit={submit} noValidate>
          <p className="apu-new-code">
            Quedará solo en esta actividad hasta que se registre formalmente en el catálogo.
          </p>

          <label className="writeoffs-field is-wide">
            <span>Nombre del recurso *</span>
            <input
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder={category === "labor" ? "Ej. Ayudante de obra" : "Ej. Rastrillo con placa"}
              aria-label="Nombre del recurso"
              title="Nombre del recurso"
              autoFocus
            />
          </label>

          <div className="apu-new-grid">
            <label className="writeoffs-field">
              <span>Unidad</span>
              <select
                value={values.unit}
                onChange={(event) => setValues((current) => ({ ...current, unit: event.target.value }))}
                aria-label="Unidad del recurso"
                title="Unidad en que se compra o se mide"
              >
                {unitsFor(category).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>

            <label className="writeoffs-field">
              <span>{rateLabel} *</span>
              <input
                inputMode="numeric"
                value={values.dailyRate}
                onChange={(event) => setValues((current) => ({ ...current, dailyRate: event.target.value }))}
                placeholder="0"
                aria-label={rateLabel}
                title={rateLabel}
              />
            </label>

            <label className="writeoffs-field">
              <span>Cantidad</span>
              <input
                inputMode="decimal"
                value={values.quantity}
                onChange={(event) => setValues((current) => ({ ...current, quantity: event.target.value }))}
                placeholder="1"
                aria-label="Cantidad del recurso"
                title="Cantidad que necesita la actividad"
              />
            </label>

            {category !== "materials" ? (
              <label className="writeoffs-field">
                <span>Rendimiento diario</span>
                <input
                  inputMode="decimal"
                  value={values.yieldPerDay}
                  onChange={(event) => setValues((current) => ({ ...current, yieldPerDay: event.target.value }))}
                  placeholder="1"
                  aria-label="Rendimiento diario del recurso"
                  title="Rendimiento: cuánto produce o avanza por día"
                />
              </label>
            ) : null}
          </div>

          {error ? (
            <p className="writeoffs-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="modal-footer apu-new-actions">
            <button type="button" className="apu-import-secondary" onClick={onClose} title="Cancelar">
              Cancelar
            </button>
            <button type="submit" title="Agregar el recurso a esta actividad">
              Agregar recurso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
