"use client";

import { useMemo, useState } from "react";

const collator = new Intl.Collator("es-CO", { numeric: true, sensitivity: "base" });
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Props = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCreate: (value: string) => void;
  placeholder: string;
  label: string;
  required?: boolean;
};

export function InlineCatalogCombobox({ value, options, onChange, onCreate, placeholder, label, required = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const cleanValue = value.trim();
  const matches = useMemo(() => {
    const query = normalize(cleanValue);
    return [...new Set(options.map((option) => option.trim()).filter(Boolean))]
      .filter((option) => !query || normalize(option).includes(query))
      .sort(collator.compare)
      .slice(0, 7);
  }, [cleanValue, options]);
  const exists = options.some((option) => normalize(option.trim()) === normalize(cleanValue));

  return <div className="inline-catalog-combobox">
    <input aria-autocomplete="list" aria-expanded={isOpen} aria-label={label} autoComplete="off" onBlur={() => setIsOpen(false)} onChange={(event) => { onChange(event.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} placeholder={placeholder} required={required} role="combobox" value={value} />
    {isOpen && <div className="inline-catalog-options" role="listbox">
      {matches.map((option) => <button key={option} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option); setIsOpen(false); }} role="option" type="button">{option}</button>)}
      {cleanValue && !exists ? <button className="inline-catalog-create" onMouseDown={(event) => event.preventDefault()} onClick={() => { onCreate(cleanValue); onChange(cleanValue); setIsOpen(false); }} type="button">Crear “{cleanValue}”</button> : null}
      {!matches.length && !cleanValue ? <p>Escribe para filtrar o crear una opción.</p> : null}
    </div>}
  </div>;
}
