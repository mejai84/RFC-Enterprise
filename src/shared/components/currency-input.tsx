"use client";

import { useState, type InputHTMLAttributes } from "react";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function toRawCopValue(value: string) {
  const sign = value.trim().startsWith("-") ? "-" : "";
  return `${sign}${value.replace(/\D/g, "")}`;
}

function formatCopValue(value: string) {
  if (!value || value === "-") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? copFormatter.format(amount).replace(/\s/g, "") : "";
}

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function CurrencyInput({ value, onValueChange, onFocus, onBlur, ...props }: CurrencyInputProps) {
  const [isEditing, setIsEditing] = useState(false);

  return <input {...props} type="text" inputMode="numeric" value={isEditing ? value : formatCopValue(value)} onChange={(event) => onValueChange(toRawCopValue(event.target.value))} onFocus={(event) => { setIsEditing(true); onFocus?.(event); }} onBlur={(event) => { setIsEditing(false); onBlur?.(event); }} />;
}
