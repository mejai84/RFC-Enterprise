"use client";

import { useMemo, useState } from "react";
import type { LaborActivityType, LaborPosition, LaborPositionCatalog } from "@/modules/apu";

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
  const [selectedId, setSelectedId] = useState("");

  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-CO");
    return catalog.positions.filter((position) => {
      if (activityType !== "all" && position.activityType !== activityType) return false;
      if (!term) return true;
      return [position.code, position.name, position.specialtyLabel, position.summary]
        .some((value) => value.toLocaleLowerCase("es-CO").includes(term));
    });
  }, [activityType, catalog.positions, query]);

  const visibleMatches = matches.slice(0, 80);
  const selected = catalog.positions.find((position) => position.id === selectedId);

  return (
    <div className="apu-labor-picker">
      <div className="apu-labor-controls">
        <label>
          <span>Buscar cargo</span>
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }}
            placeholder="Ej. oficial, soldador, HSE…"
          />
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
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={isLoading || !visibleMatches.length}>
            <option value="">{isLoading ? "Cargando cargos…" : `Seleccione entre ${matches.length} cargos`}</option>
            {visibleMatches.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name} · N{position.level} · {formatCOP(position.totalDailyRate)}/día
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!selected} onClick={() => selected && onAdd(selected)}>Agregar cargo</button>
        <button type="button" className="apu-secondary-action" onClick={onAddManual}>Agregar manual</button>
      </div>
      <div className="apu-labor-status" aria-live="polite">
        <span className={`apu-source-badge is-${catalog.source}`}>{catalog.source === "database" ? "Base de datos" : "Respaldo local"}</span>
        <small>{catalog.positions.length} cargos disponibles{matches.length > 80 ? " · refine la búsqueda para ver más resultados" : ""}</small>
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
