"use client";

import { useState, type FormEvent } from "react";
import { ApuUnitCombobox } from "./apu-unit-combobox";

type Props = {
  defaultName?: string;
  defaultUnit?: string;
  nextCode: string;
  onClose: () => void;
  onCreate: (values: { name: string; unit: string; workQuantity: number }) => void;
};

/**
 * Alta de una actividad. Se pide nombre, unidad y cantidad de obra porque son los
 * tres datos con los que nace el APU: sin cantidad real, el costo por unidad que se
 * muestra después no significa nada.
 */
export function ApuNewModal({ defaultName, defaultUnit, nextCode, onClose, onCreate }: Props) {
  const [name, setName] = useState(defaultName ?? "");
  const [unit, setUnit] = useState(defaultUnit ?? "m²");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 3) {
      setError("Escribe el nombre de la actividad.");
      return;
    }
    const parsed = Number(quantity.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("La cantidad de obra debe ser un número mayor que cero.");
      return;
    }
    if (!unit.trim()) {
      setError("Elige la unidad de medida de la actividad.");
      return;
    }
    onCreate({ name: cleanName, unit: unit.trim(), workQuantity: parsed });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="apu-new-title">
      <div className="modal-card apu-new-card">
        <div className="modal-header">
          <div>
            <p>Análisis de precios unitarios</p>
            <h3 id="apu-new-title">Nueva actividad</h3>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Cerrar" title="Cerrar">
            ✕
          </button>
        </div>

        <form className="apu-new-form-body" onSubmit={submit} noValidate>
          <p className="apu-new-code">
            Se creará como <strong>{nextCode}</strong>. Puedes cambiar los recursos y la tarifa más adelante.
          </p>

          <label className="writeoffs-field is-wide">
            <span>Nombre de la actividad *</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Excavación de material común"
              aria-label="Nombre de la actividad"
              title="Nombre de la actividad"
              autoFocus
            />
          </label>

          <div className="apu-new-grid">
            <label className="writeoffs-field">
              <span>Unidad de medida *</span>
              <ApuUnitCombobox value={unit} onChange={setUnit} />
            </label>
            <label className="writeoffs-field">
              <span>Cantidad de obra *</span>
              <input
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="1"
                aria-label="Cantidad de obra de la actividad"
                title="Cantidad de obra: es el divisor del costo por unidad"
              />
              <small>Es el divisor del costo por unidad. Si la dejas en 1, el costo por unidad será igual al total.</small>
            </label>
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
            <button type="submit" title="Crear la actividad y abrirla">
              Crear actividad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
