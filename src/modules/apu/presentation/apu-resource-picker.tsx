"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { ApuCategory } from "@/modules/apu";
import type { StockProduct } from "@/modules/inventory";
import { inventorySearchText } from "@/modules/inventory";
import { rankItems } from "../domain/search-utils";

const formatCOP = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Props = {
  category: Extract<ApuCategory, "materials" | "equipment">;
  products: StockProduct[];
  catalogLoading?: boolean;
  catalogError?: string;
  onAdd: (product?: StockProduct) => void;
  /** Pide el alta manual pasando lo que el usuario ya escribió en el buscador. */
  onAddManual: (query: string) => void;
  /** Limpia el buscador; se invoca al aceptar el alta manual. */
  clearSignal?: number;
};

export function ApuResourcePicker({
  category,
  products,
  catalogLoading = false,
  catalogError,
  onAdd,
  onAddManual,
  clearSignal = 0,
}: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const showResults = isOpen && Boolean(query.trim()) && !catalogLoading && !catalogError;
  const [showAll, setShowAll] = useState(false);
  const resourceLabel = category === "materials" ? "material" : "equipo o herramienta";
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return rankItems(products, query, (p) => p.name, (p) => inventorySearchText(p)).slice(0, 200);
  }, [products, query]);

  const visibleMatches = showAll ? matches : matches.slice(0, 8);
  const totalMatches = useMemo(() => {
    if (!query.trim()) return 0;
    return rankItems(products, query, (p) => p.name, (p) => inventorySearchText(p)).length;
  }, [products, query]);

  // Cuando el padre confirma el alta manual, el buscador queda limpio.
  useEffect(() => {
    setQuery("");
    setIsOpen(false);
  }, [clearSignal]);

  function addProduct(product: StockProduct) {
    onAdd(product);
    setQuery("");
    setIsOpen(false);
  }

  const noMatches = Boolean(query.trim()) && totalMatches === 0 && !catalogLoading && !catalogError;

  return (
    <div className="apu-resource-picker">
      <label className="apu-resource-search">
        <span className="sr-only">Buscar {resourceLabel} en inventario</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showResults}
          aria-label={`Buscar ${resourceLabel} en inventario`}
          placeholder={
            catalogLoading
              ? "Cargando inventario…"
              : catalogError
                ? "Inventario no disponible"
                : `Buscar ${resourceLabel} en inventario`
          }
          type="search"
          value={query}
          disabled={catalogLoading || Boolean(catalogError)}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={(event) => { if (event.key === "Escape") setIsOpen(false); }}
        />
        {query ? (
          <button
            type="button"
            className="apu-clear-search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { setQuery(""); setIsOpen(false); }}
            aria-label={`Limpiar búsqueda de ${resourceLabel}`}
            title="Limpiar búsqueda"
          >
            ✕
          </button>
        ) : null}
      </label>
      <button
        type="button"
        className="apu-resource-manual"
        onClick={() => onAddManual(query)}
        disabled={catalogLoading}
        title={
          noMatches
            ? `No hay coincidencias para "${query}". Agregar este ${resourceLabel} manualmente`
            : `Agregar un ${resourceLabel} que no está en el inventario`
        }
      >
        + Manual
      </button>

      {catalogError ? (
        <p className="apu-filter-empty">No se pudo leer el inventario: {catalogError}</p>
      ) : null}
      {!catalogError && !catalogLoading ? (
        <p className="apu-resource-note">
          El APU costea lo que la obra necesitará. Si hoy no hay existencias, el material
          se compra o ingresa al inventario y se despacha a la obra cuando se ejecute.
        </p>
      ) : null}

      {noMatches ? (
        <p className="apu-filter-empty">
          No encontramos “{query.trim()}” en el inventario. Usa{" "}
          <button type="button" className="apu-inline-link" onClick={() => onAddManual(query)}>
            + Manual
          </button>{" "}
          para ingresarlo a mano.
        </p>
      ) : null}

      {showResults && (
        <div className="apu-resource-results" id={listId} role="listbox" aria-label={`Resultados de ${resourceLabel}`}>
          <p className="apu-resource-count" aria-live="polite">
            {totalMatches === 0
              ? "Sin coincidencias en el inventario"
              : `${totalMatches} coincidencia${totalMatches === 1 ? "" : "s"}`}
          </p>
          {visibleMatches.map((product) => (
            <button
              key={product.id}
              role="option"
              type="button"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addProduct(product)}
            >
              <span>
                <strong>{product.name}</strong>
                <small>
                  {product.category || "Sin categoría"}
                  {product.sku ? ` · ${product.sku}` : ""}
                </small>
              </span>
              <b className={product.available > 0 ? "" : "is-pending"}>
                {Number(product.available ?? 0).toLocaleString("es-CO")} {product.unit}
              </b>
            </button>
          ))}
          {matches.length === 0 && products.length > 0 ? (
            <p className="apu-resource-hint">
              Este artículo no está en el catálogo. Agréguelo como recurso manual: quedará
              marcado para compra o ingreso al inventario.
            </p>
          ) : null}
          {matches.length > visibleMatches.length ? (
            <button
              type="button"
              className="apu-resource-more"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setShowAll(true)}
            >
              Ver los {matches.length} resultados
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
