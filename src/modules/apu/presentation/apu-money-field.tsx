"use client";

import { useEffect, useRef, useState } from "react";
import { CurrencyInput } from "@/shared/components/currency-input";

type Props = {
  value: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
};

/**
 * Campo de tarifa editable que se muestra como moneda.
 * Mientras se escribe se comporta como un campo numérico corriente (para poder
 * teclear "15000" sin los signos de pesos estorbando) y al salir o tabular
 * queda formateado como pesos colombianos. Solo confirma al terminar la edición,
 * para no disparar un guardado en la base de datos con cada tecla.
 */
export function ApuMoneyField({ value, onCommit, ariaLabel, placeholder, className }: Props) {
  const [raw, setRaw] = useState(() => (value > 0 ? String(Math.round(value)) : ""));
  const committed = useRef(value);

  // Si el valor cambia desde afuera (importación, reversión, carga), se refleja.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setRaw(value > 0 ? String(Math.round(value)) : "");
    }
  }, [value]);

  function commit() {
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    committed.current = safe;
    onCommit(safe);
  }

  return (
    <CurrencyInput
      className={className}
      value={raw}
      onValueChange={setRaw}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          (event.target as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder ?? "0"}
      aria-label={ariaLabel}
      title={ariaLabel}
    />
  );
}
