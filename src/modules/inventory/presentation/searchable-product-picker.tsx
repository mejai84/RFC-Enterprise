"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { StockProduct } from "../index";
import { matchesInventorySearch } from "../index";

const spanishCollator = new Intl.Collator("es-CO", { numeric: true, sensitivity: "base" });

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
  const listboxId = useId();
  const selectedProduct = products.find((product) => product.id === value);
  const [prevValue, setPrevValue] = useState(value);
  const [query, setQuery] = useState(selectedProduct?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  if (prevValue !== value) {
    setPrevValue(value);
    setQuery(selectedProduct?.name ?? "");
  }

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside);
  }, []);

  const results = useMemo(() => {
    return [...products]
      .filter((product) => matchesInventorySearch(product, query))
      .sort((a, b) => spanishCollator.compare(a.name, b.name))
      .slice(0, 8);
  }, [products, query]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        aria-autocomplete="list"
        aria-controls={listboxId}
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
        <div className="autocomplete-results" id={listboxId} role="listbox">
          {results.length > 0 ? results.map((product) => (
            <button
              aria-selected={product.id === value}
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
