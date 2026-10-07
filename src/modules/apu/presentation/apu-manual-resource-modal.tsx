"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apuCategoryMeta, type ApuCategory } from "@/modules/apu";
import { ApuQuantityField } from "./apu-quantity-field";
import { roundApuQuantity } from "./apu-quantity";

export type ManualResource = {
  name: string;
  unit: string;
  quantity: number;
  yieldPerDay: number;
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
  const [name, setName] = useState(suggested);
  const [unit, setUnit] = useState(unitsFor(category)[0]);
  const [quantityValue, setQuantityValue] = useState(1);
  const [yieldValue, setYieldValue] = useState(1);
  const [dailyRate, setDailyRate] = useState("");
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
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError("Escribe el nombre del recurso.");
      return;
    }
    const rate = Number(dailyRate.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (!Number.isFinite(rate) || rate < 0) {
      setError("La tarifa debe ser un número mayor o igual a cero.");
      return;
    }
    onAccept({
      name: cleanName,
      unit,
      quantity: roundApuQuantity(quantityValue),
      yieldPerDay: category === "materials" ? 1 : roundApuQuantity(yieldValue),
      dailyRate,
    });
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
              value={name}
              onChange={(event) => setName(event.target.value)}
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
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
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
                value={dailyRate}
                onChange={(event) => setDailyRate(event.target.value)}
                placeholder="0"
                aria-label={rateLabel}
                title={rateLabel}
              />
            </label>

            <label className="writeoffs-field">
              <span>Cantidad</span>
              <ApuQuantityField
                value={quantityValue}
                onCommit={setQuantityValue}
                ariaLabel="Cantidad del recurso"
                title="Cantidad que necesita la actividad"
                placeholder="1"
              />
            </label>

            {category !== "materials" ? (
              <label className="writeoffs-field">
                <span>Rendimiento diario</span>
                <ApuQuantityField
                  value={yieldValue}
                  onCommit={setYieldValue}
                  ariaLabel="Rendimiento diario del recurso"
                  title="Rendimiento: cuánto produce o avanza por día"
                  placeholder="1"
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
