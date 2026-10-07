"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatApuQuantity, formatApuQuantityInput, parseApuQuantityInput, roundApuQuantity } from "./apu-quantity";

type Props = {
  value: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  title?: string;
  placeholder?: string;
  className?: string;
  /** Texto de ayuda debajo del campo. */
  hint?: string;
};

/**
 * Campo de cantidad del APU. Mientras se escribe admite coma o punto y muestra el
 * número sin formato para no estorbar; al salir o al tabular se convierte en número
 * y se presenta con máximo dos decimales en formato colombiano.
 *
 * Solo confirma al terminar la edición, para no disparar un guardado en la base de
 * datos con cada tecla.
 */
export function ApuQuantityField({ value, onCommit, ariaLabel, title, placeholder, className, hint }: Props) {
  const [text, setText] = useState(() => formatApuQuantityInput(value));
  const [isEditing, setIsEditing] = useState(false);
  const committed = useRef(value);

  // Si el valor cambia desde afuera (importación, carga de otra actividad), se refleja.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(formatApuQuantityInput(value));
    }
  }, [value]);

  function commit() {
    const parsed = roundApuQuantity(parseApuQuantityInput(text));
    committed.current = parsed;
    setText(formatApuQuantityInput(parsed));
    if (parsed !== value) onCommit(parsed);
    setIsEditing(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      (event.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="apu-quantity-field">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={className}
        value={isEditing ? text : formatApuQuantity(value)}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "0"}
        aria-label={ariaLabel}
        title={title ?? ariaLabel}
      />
      {hint ? <small className="apu-quantity-hint">{hint}</small> : null}
    </div>
  );
}
