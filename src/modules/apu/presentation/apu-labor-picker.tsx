"use client";

import { useMemo, useState } from "react";
import type { LaborActivityType, LaborPosition, LaborPositionCatalog } from "@/modules/apu";
import { rankItems } from "../domain/search-utils";

const formatCOP = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Props = {
  catalog: LaborPositionCatalog;
  isLoading: boolean;
  onAdd: (position: LaborPosition) => void;
  onAddManual: () => void;
};

export function ApuLaborPicker({ catalog, isLoading, onAdd, onAddManual }: Props) {
  const [query, setQuery] = useState("");
  const [activityType, setActivityType] = useState<"all" | LaborActivityType>("all");
  const [vigencia, setVigencia] = useState<string>("all");
  const [selectedId, setSelectedId] = useState("");

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
      (pos) => `${pos.specialtyLabel} ${pos.code} ${pos.summary}`
    );
  }, [activityType, vigencia, catalog.positions, query]);

  const visibleMatches = matches.slice(0, 80);
  const selected = catalog.positions.find((position) => position.id === selectedId);

  return (
    <div className="apu-labor-picker">
      <div className="apu-labor-controls">
        <label className="apu-labor-search">
          <span>Buscar cargo</span>
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }}
            placeholder="Ej. oficial, soldador, HSE…"
            aria-describedby="apu-labor-results-count"
          />
          {query.trim() ? (
            <button
              type="button"
              className="apu-clear-search"
              onClick={() => { setQuery(""); setSelectedId(""); }}
              aria-label="Limpiar búsqueda de cargos"
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          ) : null}
        </label>
        <label>
          <span>Vigencia</span>
          <select value={vigencia} onChange={(event) => { setVigencia(event.target.value); setSelectedId(""); }}>
            <option value="all">Todos los años</option>
            {vigencias.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          <span>Tipo de actividad</span>
          <select value={activityType} onChange={(event) => { setActivityType(event.target.value as typeof activityType); setSelectedId(""); }}>
            <option value="all">Todas</option>
            <option value="propias">Actividades propias</option>
            <option value="no_propias">Actividades no propias</option>
          </select>
        </label>
        <label className="apu-labor-position-select">
          <span>Puesto de trabajo</span>
          <select
            id="apu-labor-results-count"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={isLoading || !visibleMatches.length}
          >
            <option value="">
              {isLoading
                ? "Cargando cargos…"
                : matches.length === 0
                  ? "Sin coincidencias"
                  : `Seleccione entre ${matches.length} cargo${matches.length === 1 ? "" : "s"}`}
            </option>
            {visibleMatches.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name} · N{position.level} · {formatCOP(position.totalDailyRate)}/día
              </option>
            ))}
          </select>
        </label>
        <div className="apu-labor-actions">
          <button type="button" disabled={!selected} onClick={() => selected && onAdd(selected)}>
            Agregar cargo
          </button>
          <button type="button" className="apu-secondary-action" onClick={onAddManual}>
            Agregar manual
          </button>
        </div>
      </div>
      <div className="apu-labor-status" aria-live="polite">
        <span className={`apu-source-badge is-${catalog.source}`}>{catalog.source === "database" ? "Base de datos" : "Respaldo local"}</span>
        <small>
          {matches.length === catalog.positions.length
            ? `${catalog.positions.length} cargos disponibles`
            : `${matches.length} de ${catalog.positions.length} cargos coinciden`}
          {matches.length > 80 ? " · refine la búsqueda para ver más resultados" : ""}
        </small>
        {matches.length === 0 && catalog.positions.length > 0 ? (
          <small className="apu-filter-empty">Sin coincidencias: revise el texto o quite los filtros.</small>
        ) : null}
        {catalog.warning ? <small title={catalog.warning}>No se pudo consultar la tabla en línea.</small> : null}
      </div>
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
