"use client";

import { useId, useState } from "react";

export type MeasurementUnit = {
  name: string;
  symbol: string;
  aliases?: string[];
};

const measurementUnits: MeasurementUnit[] = [
  { name: "Unidad", symbol: "und", aliases: ["unidad", "un", "ud"] },
  { name: "Global", symbol: "glb", aliases: ["global", "suma global"] },
  { name: "Kilogramo", symbol: "kg", aliases: ["kilo", "kilogramos"] },
  { name: "Gramo", symbol: "g", aliases: ["gramo", "gramos"] },
  { name: "Tonelada", symbol: "t", aliases: ["tonelada", "toneladas"] },
  { name: "Libra", symbol: "lb", aliases: ["libra", "libras"] },
  { name: "Onza", symbol: "oz", aliases: ["onza", "onzas"] },
  { name: "Metro", symbol: "m", aliases: ["metro", "metros"] },
  { name: "Metro lineal", symbol: "ml", aliases: ["metro lineal", "metros lineales"] },
  { name: "Centímetro", symbol: "cm", aliases: ["centimetro", "centímetros"] },
  { name: "Milímetro", symbol: "mm", aliases: ["milimetro", "milímetros"] },
  { name: "Kilómetro", symbol: "km", aliases: ["kilometro", "kilómetros"] },
  { name: "Pulgada", symbol: "in", aliases: ["pulgada", "pulgadas"] },
  { name: "Pie", symbol: "ft", aliases: ["pie", "pies"] },
  { name: "Yarda", symbol: "yd", aliases: ["yarda", "yardas"] },
  { name: "Milla", symbol: "mi", aliases: ["milla", "millas"] },
  { name: "Metro cuadrado", symbol: "m²", aliases: ["metro cuadrado", "metros cuadrados", "m2"] },
  { name: "Centímetro cuadrado", symbol: "cm²", aliases: ["centimetro cuadrado", "centímetros cuadrados", "cm2"] },
  { name: "Pie cuadrado", symbol: "ft²", aliases: ["pie cuadrado", "pies cuadrados", "ft2"] },
  { name: "Yarda cuadrada", symbol: "yd²", aliases: ["yarda cuadrada", "yardas cuadradas", "yd2"] },
  { name: "Hectárea", symbol: "ha", aliases: ["hectarea", "hectáreas"] },
  { name: "Acre", symbol: "ac", aliases: ["acres"] },
  { name: "Metro cúbico", symbol: "m³", aliases: ["metro cubico", "metros cúbicos", "m3"] },
  { name: "Centímetro cúbico", symbol: "cm³", aliases: ["centimetro cubico", "centímetros cúbicos", "cm3"] },
  { name: "Pie cúbico", symbol: "ft³", aliases: ["pie cubico", "pies cúbicos", "ft3"] },
  { name: "Yarda cúbica", symbol: "yd³", aliases: ["yarda cubica", "yardas cúbicas", "yd3"] },
  { name: "Litro", symbol: "L", aliases: ["litro", "litros"] },
  { name: "Mililitro", symbol: "mL", aliases: ["mililitro", "mililitros"] },
  { name: "Galón", symbol: "gal", aliases: ["galon", "galones"] },
  { name: "Barril", symbol: "bbl", aliases: ["barril", "barriles"] },
  { name: "Metro cúbico por hora", symbol: "m³/h", aliases: ["caudal", "metros cubicos por hora"] },
  { name: "Litro por segundo", symbol: "L/s", aliases: ["litros por segundo", "caudal"] },
  { name: "Hora", symbol: "h", aliases: ["hora", "horas", "hora hombre", "hora maquina"] },
  { name: "Hora hombre", symbol: "HH", aliases: ["hora hombre", "horas hombre"] },
  { name: "Hora máquina", symbol: "HM", aliases: ["hora maquina", "horas maquina"] },
  { name: "Día", symbol: "día", aliases: ["dia", "dias", "día", "días"] },
  { name: "Semana", symbol: "sem", aliases: ["semana", "semanas"] },
  { name: "Mes", symbol: "mes", aliases: ["meses"] },
  { name: "Jornada", symbol: "jor", aliases: ["jornada", "jornadas"] },
  { name: "Viaje", symbol: "viaje", aliases: ["viajes"] },
  { name: "Servicio", symbol: "serv", aliases: ["servicio", "servicios"] },
  { name: "Punto", symbol: "pto", aliases: ["punto", "puntos"] },
  { name: "Paquete", symbol: "paq", aliases: ["paquete", "paquetes"] },
  { name: "Caja", symbol: "caja", aliases: ["cajas"] },
  { name: "Caja por 100", symbol: "cj/100", aliases: ["caja cien", "caja x 100"] },
  { name: "Bulto", symbol: "bulto", aliases: ["bultos"] },
  { name: "Bolsa", symbol: "bolsa", aliases: ["bolsas"] },
  { name: "Saco", symbol: "saco", aliases: ["sacos"] },
  { name: "Caneca", symbol: "caneca", aliases: ["canecas"] },
  { name: "Tambor", symbol: "tambor", aliases: ["tambores"] },
  { name: "Cartucho", symbol: "cart", aliases: ["cartucho", "cartuchos"] },
  { name: "Frasco", symbol: "frasco", aliases: ["frascos"] },
  { name: "Botella", symbol: "botella", aliases: ["botellas"] },
  { name: "Rollo", symbol: "rollo", aliases: ["rollos"] },
  { name: "Carrete", symbol: "carrete", aliases: ["carretes"] },
  { name: "Juego", symbol: "jgo", aliases: ["juego", "juegos"] },
  { name: "Par", symbol: "par", aliases: ["pares"] },
  { name: "Docena", symbol: "doc", aliases: ["docena", "docenas"] },
  { name: "Centena", symbol: "cent", aliases: ["centena", "centenas", "ciento"] },
  { name: "Millar", symbol: "mil", aliases: ["millar", "millares"] },
  { name: "Kit", symbol: "kit", aliases: ["kits"] },
  { name: "Placa", symbol: "placa", aliases: ["placas"] },
  { name: "Varilla", symbol: "var", aliases: ["varilla", "varillas"] },
  { name: "Tramo", symbol: "tramo", aliases: ["tramos"] },
  { name: "Pulgada de diámetro", symbol: "in-dia", aliases: ["pulgada diametro", "diametro"] },
  { name: "Amperio", symbol: "A", aliases: ["amperio", "amperios"] },
  { name: "Voltio", symbol: "V", aliases: ["voltio", "voltios"] },
  { name: "Kilovatio", symbol: "kW", aliases: ["kilovatio", "kilovatios"] },
  { name: "Kilovoltamperio", symbol: "kVA", aliases: ["kilovoltamperio", "kilovoltamperios"] },
  { name: "Kilovatio hora", symbol: "kWh", aliases: ["kilovatio hora", "kilovatios hora"] },
  { name: "Ohmio", symbol: "Ω", aliases: ["ohmio", "ohmios", "ohm"] },
  { name: "Pascal", symbol: "Pa", aliases: ["pascal", "pascales"] },
  { name: "Libra por pulgada cuadrada", symbol: "psi", aliases: ["psi", "presion"] },
  { name: "Grado Celsius", symbol: "°C", aliases: ["celsius", "grado", "temperatura"] },
];

const normalizeSearchText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CO");

type Props = {
  value: string;
  onChange: (unit: string) => void;
  name?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
};

/** Selector de unidad de medida con búsqueda en vivo. */
export function ApuUnitCombobox({ value, onChange, name, className = "", id, ariaLabel }: Props) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = normalizeSearchText(query.trim());
  const results = measurementUnits.filter((unit) => {
    const searchable = [unit.name, unit.symbol, ...(unit.aliases ?? [])].join(" ");
    return !normalizedQuery || normalizeSearchText(searchable).includes(normalizedQuery);
  });

  function selectUnit(unit: MeasurementUnit) {
    onChange(unit.symbol);
    setQuery(unit.symbol);
    setIsOpen(false);
  }

  return (
    <div className={`apu-unit-combobox ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <input
        id={id}
        value={query}
        role="combobox"
        aria-label={ariaLabel ?? "Unidad de medida"}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={isOpen}
        placeholder="Unidad"
        onFocus={(event) => { setIsOpen(true); event.currentTarget.select(); }}
        onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
        onBlur={() => window.setTimeout(() => { setIsOpen(false); setQuery(value); }, 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setIsOpen(false); setQuery(value); }
          if (event.key === "Enter" && isOpen && results.length) { event.preventDefault(); selectUnit(results[0]); }
        }}
      />
      {isOpen ? (
        <div id={listId} className="apu-unit-options" role="listbox" aria-label="Unidades de medida disponibles">
          {results.length ? results.map((unit) => (
            <button type="button" role="option" aria-selected={value === unit.symbol} key={unit.symbol} onMouseDown={(event) => event.preventDefault()} onClick={() => selectUnit(unit)}>
              <span>{unit.name}</span><strong>{unit.symbol}</strong>
            </button>
          )) : <p>No hay una unidad que coincida.</p>}
        </div>
      ) : null}
    </div>
  );
}
