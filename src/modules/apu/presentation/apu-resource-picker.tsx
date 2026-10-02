"use client";

import { useId, useMemo, useState } from "react";
import type { ApuCategory } from "@/modules/apu";
import type { StockProduct } from "@/modules/inventory";

const formatCOP = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Props = {
  category: Extract<ApuCategory, "materials" | "equipment">;
  products: StockProduct[];
  onAdd: (product?: StockProduct) => void;
};

export function ApuResourcePicker({ category, products, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const resourceLabel = category === "materials" ? "material" : "equipo o herramienta";
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-CO");
    if (!term) return [];
    return products
      .filter((product) => [product.name, product.sku, product.category, product.brand].filter(Boolean).some((value) => String(value).toLocaleLowerCase("es-CO").includes(term)))
      .slice(0, 6);
  }, [products, query]);

  function addProduct(product: StockProduct) {
    onAdd(product);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div className="apu-resource-picker">
      <label className="apu-resource-search">
        <span className="sr-only">Buscar {resourceLabel} en inventario</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen && Boolean(query.trim())}
          placeholder={`Buscar ${resourceLabel} en inventario`}
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => { if (event.key === "Escape") setIsOpen(false); }}
        />
      </label>
      <button type="button" className="apu-resource-manual" onClick={() => onAdd()}>+ Manual</button>
      {isOpen && query.trim() ? (
        <div className="apu-resource-results" id={listId} role="listbox" aria-label={`Resultados de ${resourceLabel}`}>
          {matches.length ? matches.map((product) => (
            <button key={product.id} role="option" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addProduct(product)}>
              <span><strong>{product.name}</strong><small>{product.sku || product.category || "Sin código"} · {product.unit}</small></span>
              <b>{formatCOP(product.unitCost || 0)}</b>
            </button>
          )) : <p>No hay coincidencias. Puedes agregarlo como recurso manual.</p>}
        </div>
      ) : null}
    </div>
  );
}
