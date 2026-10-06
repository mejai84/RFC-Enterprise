"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { LaborActivityType, LaborPosition, LaborPositionCatalog } from "@/modules/apu";
import { rankItems } from "../domain/search-utils";

const formatCOP = (value: number) =>
  value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Props = {
  catalog: LaborPositionCatalog;
  isLoading: boolean;
  onAdd: (position: LaborPosition) => void;
  onAddManual: (query: string) => void;
  /** Limpia el buscador; se invoca al aceptar el alta manual. */
  clearSignal?: number;
};

/**
 * Buscador de cargos con el mismo comportamiento del buscador de inventario:
 * se escribe y la lista se filtra en vivo; al elegir el cargo se agrega al APU.
 */
export function ApuLaborPicker({ catalog, isLoading, onAdd, onAddManual, clearSignal = 0 }: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activityType, setActivityType] = useState<"all" | LaborActivityType>("all");
  const [vigencia, setVigencia] = useState<string>("all");
  const [selectedId, setSelectedId] = useState("");
  const listId = useId();

  const vigencias = useMemo(() => {
    const years = catalog.positions.map((p) => p.validTo.substring(0, 4));
    return Array.from(new Set(years)).sort().reverse();
  }, [catalog.positions]);

  const matches = useMemo(() => {
    let pool = catalog.positions;
    if (activityType !== "all") {
      pool = pool.filter((position) => position.activityType === activityType);
    }
    if (vigencia !== "all") {
      pool = pool.filter((position) => position.validTo.startsWith(vigencia));
    }
    if (!query.trim()) return pool;
    return rankItems(
      pool,
      query,
      (pos) => pos.name,
      (pos) => `${pos.specialtyLabel} ${pos.code} ${pos.summary}`,
    );
  }, [activityType, vigencia, catalog.positions, query]);

  const selected = catalog.positions.find((position) => position.id === selectedId);
  const showResults = isOpen && !isLoading && matches.length > 0;
  const visibleMatches = matches.slice(0, 40);
  const hasFilters = activityType !== "all" || vigencia !== "all";

  function pick(position: LaborPosition) {
    setSelectedId(position.id);
    onAdd(position);
    setQuery("");
    setIsOpen(false);
  }

  // Cuando el padre confirma el alta manual, el buscador queda limpio.
  useEffect(() => {
    setQuery("");
    setSelectedId("");
    setIsOpen(false);
  }, [clearSignal]);

  return (
    <div className="apu-labor-picker">
      <div className="apu-labor-controls">
        <label className="apu-labor-search">
          <span>Buscar cargo</span>
          <input
            type="search"
            value={query}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={showResults}
            aria-label="Buscar cargo en el catálogo salarial"
            placeholder={isLoading ? "Cargando cargos…" : "Ej. oficial, soldador, HSE…"}
            disabled={isLoading}
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
              aria-label="Limpiar búsqueda de cargos"
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          ) : null}
        </label>

        <label>
          <span>Vigencia</span>
          <select value={vigencia} onChange={(event) => { setVigencia(event.target.value); setSelectedId(""); setIsOpen(true); }}>
            <option value="all">Todos los años</option>
            {vigencias.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>

        <label>
          <span>Tipo de actividad</span>
          <select value={activityType} onChange={(event) => { setActivityType(event.target.value as typeof activityType); setSelectedId(""); setIsOpen(true); }}>
            <option value="all">Todas</option>
            <option value="propias">Actividades propias</option>
            <option value="no_propias">Actividades no propias</option>
          </select>
        </label>

        <div className="apu-labor-actions">
          <button
            type="button"
            onClick={() => { setIsOpen(true); setQuery(""); }}
            title="Ver todos los cargos del catálogo"
          >
            Ver todos ({catalog.positions.length})
          </button>
          <button
            type="button"
            className="apu-secondary-action"
            onClick={() => onAddManual(query)}
            title={
              query.trim() && matches.length === 0
                ? `No encontramos "${query}" en la tabla salarial. Ingresarlo a mano`
                : "Agregar un cargo que no está en la tabla salarial"
            }
          >
            Agregar manual
          </button>
        </div>
      </div>

      <div className="apu-labor-status" aria-live="polite">
        <span className={`apu-source-badge is-${catalog.source}`}>
          {catalog.source === "database" ? "Base de datos" : "Respaldo local"}
        </span>
        <small>
          {matches.length === catalog.positions.length
            ? `${catalog.positions.length} cargos disponibles`
            : `${matches.length} de ${catalog.positions.length} cargos coinciden`}
        </small>
        {hasFilters ? (
          <button
            type="button"
            className="apu-filter-reset"
            onClick={() => { setActivityType("all"); setVigencia("all"); }}
          >
            Quitar filtros
          </button>
        ) : null}
        {matches.length === 0 && catalog.positions.length > 0 ? (
          <small className="apu-filter-empty">Sin coincidencias: revise el texto o quite los filtros.</small>
        ) : null}
        {catalog.warning ? <small title={catalog.warning}>No se pudo consultar la tabla en línea.</small> : null}
      </div>

      {showResults && (
        <div className="apu-resource-results" id={listId} role="listbox" aria-label="Cargos encontrados">
          <p className="apu-resource-count" aria-live="polite">
            {matches.length} coincidencia{matches.length === 1 ? "" : "s"}
          </p>
          {visibleMatches.map((position) => (
            <button
              key={position.id}
              role="option"
              type="button"
              aria-selected={selectedId === position.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(position)}
            >
              <span>
                <strong>{position.name}</strong>
                <small>
                  {position.specialtyLabel} · N{position.level} · {position.activityType === "propias" ? "propia" : "no propia"}
                </small>
              </span>
              <b>{formatCOP(position.totalDailyRate)}/día</b>
            </button>
          ))}
          {matches.length > visibleMatches.length ? (
            <p className="apu-resource-hint">
              Se muestran {visibleMatches.length} de {matches.length}. Afine la búsqueda para ver más.
            </p>
          ) : null}
        </div>
      )}

      {selected ? (
        <div className="apu-labor-detail">
          <strong>{selected.code} · {selected.specialtyLabel} · Nivel {selected.level}</strong>
          <span>Salario {formatCOP(selected.dailyBasicSalary)} + transporte {formatCOP(selected.transportAllowance)} + alimentación {formatCOP(selected.foodAllowance)}{selected.nonSalaryAllowance ? ` + auxilio ${formatCOP(selected.nonSalaryAllowance)}` : ""}</span>
          <strong>Total diario: {formatCOP(selected.totalDailyRate)}</strong>
          <small>Vigencia: {selected.validFrom} a {selected.validTo}</small>
        </div>
      ) : null}
    </div>
  );
}
