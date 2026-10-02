"use client";

import { useMemo, useState } from "react";
import { apuActivities, type ApuActivity } from "@/modules/apu";
import { rankItems, normalizeSearchText } from "../domain/search-utils";

type Props = {
  onCreate: (activity: ApuActivity) => void;
};

export function ApuActivityCatalog({ onCreate }: Props) {
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // Lista única de grupos/categorías del catálogo
  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const a of apuActivities) {
      if (a.group) set.add(a.group);
    }
    return Array.from(set);
  }, []);

  // Filtrado y ranking tolerante a tildes, mayúsculas y palabras compuestas
  const matches = useMemo(() => {
    let pool = apuActivities;
    if (selectedGroup !== "all") {
      pool = pool.filter((item) => item.group === selectedGroup);
    }

    if (!search.trim()) {
      return pool;
    }

    return rankItems(
      pool,
      search,
      (activity) => activity.name,
      (activity) => activity.group
    );
  }, [search, selectedGroup]);

  const customName = search.trim();
  const exactMatchExists = useMemo(() => {
    if (!customName) return true;
    const norm = normalizeSearchText(customName);
    return apuActivities.some((a) => normalizeSearchText(a.name) === norm);
  }, [customName]);

  return (
    <section className="apu-activity-catalog" aria-label="Catálogo de actividades APU">
      <div className="apu-catalog-header">
        <div>
          <strong>Catálogo de actividades APU</strong>
          <small>
            {apuActivities.length} actividades disponibles. Busca o selecciona una para iniciar tu análisis.
          </small>
        </div>

        {/* Buscador con normalización de caracteres e icono de borrado */}
        <div className="apu-catalog-search-wrap">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar actividad: soldadura, tubería, sandblasting, excavación, concreto…"
            aria-label="Buscar o agregar actividad APU"
            autoComplete="off"
            className="apu-catalog-search-input"
          />
          {search && (
            <button
              type="button"
              className="apu-catalog-clear-btn"
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Chips de grupos / especialidades */}
      <div className="apu-group-chips" role="group" aria-label="Filtrar por grupo">
        <button
          type="button"
          className={`apu-chip ${selectedGroup === "all" ? "is-active" : ""}`}
          onClick={() => setSelectedGroup("all")}
        >
          Todas ({apuActivities.length})
        </button>
        {groups.map((group) => {
          const count = apuActivities.filter((a) => a.group === group).length;
          return (
            <button
              key={group}
              type="button"
              className={`apu-chip ${selectedGroup === group ? "is-active" : ""}`}
              onClick={() => setSelectedGroup(group === selectedGroup ? "all" : group)}
            >
              {group} ({count})
            </button>
          );
        })}
      </div>

      {/* Grilla de resultados de actividades */}
      <div className="apu-activity-results">
        {matches.length > 0 ? (
          matches.slice(0, 18).map((activity) => (
            <button
              type="button"
              key={activity.name}
              onClick={() => onCreate(activity)}
              className="apu-activity-card"
            >
              <span className="activity-card-name">{activity.name}</span>
              <small className="activity-card-meta">
                {activity.group} · Unidad: <strong>{activity.unit}</strong>
              </small>
            </button>
          ))
        ) : (
          <div className="apu-catalog-no-results">
            <p>
              No se encontraron actividades con “<strong>{search}</strong>”.
            </p>
          </div>
        )}
      </div>

      {/* Opción para agregar como actividad personalizada si no coincide exactamente */}
      {customName && !exactMatchExists && (
        <button
          className="apu-custom-activity"
          type="button"
          onClick={() =>
            onCreate({
              name: customName,
              unit: "und",
              group: selectedGroup !== "all" ? selectedGroup : "Personalizada",
            })
          }
        >
          + Crear “<strong>{customName}</strong>” como nueva actividad APU
        </button>
      )}
    </section>
  );
}
