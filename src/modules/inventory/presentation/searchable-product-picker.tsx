"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockProduct } from "../index";

const spanishCollator = new Intl.Collator("es-CO", { numeric: true, sensitivity: "base" });

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

type Props = {
  products: StockProduct[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  formatDetail?: (product: StockProduct) => string;
};

/** Selector de catálogo con búsqueda: evita recorrer listas extensas de insumos. */
export function SearchableProductPicker({
  products,
  value,
  onChange,
  placeholder = "Escribe para buscar por nombre o SKU…",
  formatDetail = (product) => `${product.inventoryGroupName} · ${product.location}`,
}: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedProduct = products.find((product) => product.id === value);

  useEffect(() => {
    setQuery(selectedProduct?.name ?? "");
  }, [selectedProduct?.name, value]);

  const results = useMemo(() => {
    const search = normalize(query.trim());
    return [...products]
      .filter((product) => !search || normalize(`${product.name} ${product.sku} ${product.category}`).includes(search))
      .sort((a, b) => spanishCollator.compare(a.name, b.name))
      .slice(0, 8);
  }, [products, query]);

  return (
    <div style={{ position: "relative" }}>
      <input
        aria-autocomplete="list"
        aria-expanded={isOpen}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        role="combobox"
        value={query}
      />
      {isOpen && (
        <div className="autocomplete-results" role="listbox">
          {results.length > 0 ? results.map((product) => (
            <button
              className="autocomplete-item"
              key={product.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(product.id);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              <div>
                <strong>{product.name}</strong>
                <small>{formatDetail(product)}</small>
              </div>
              <b>Disp: {product.available} {product.unit}</b>
            </button>
          )) : <p className="autocomplete-empty">No se encontraron materiales.</p>}
        </div>
      )}
    </div>
  );
}
