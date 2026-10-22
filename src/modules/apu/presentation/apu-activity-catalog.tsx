"use client";

import { useEffect, useMemo, useState } from "react";
import { apuActivities, type ApuActivity } from "@/modules/apu";
import { rankItems, normalizeSearchText } from "../domain/search-utils";

type Props = {
  onCreate: (activity: ApuActivity) => void;
};

const CATALOG_COLLAPSED_KEY = "rfc_apu_catalog_collapsed";

export function ApuActivityCatalog({ onCreate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // Recordar la preferencia del usuario en localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CATALOG_COLLAPSED_KEY);
      if (saved !== null) {
        setIsOpen(saved === "false");
      }
    } catch {
      // Si el almacenamiento local no está disponible, se mantiene cerrado por defecto
    }
  }, []);

  const toggleCatalog = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(CATALOG_COLLAPSED_KEY, String(!next));
      } catch {
        // Ignorar fallos de almacenamiento local
      }
      return next;
    });
  };

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
    <section
      className={`apu-activity-catalog ${!isOpen ? "is-collapsed" : ""}`}
      aria-label="Catálogo de actividades APU"
    >
      <div className="apu-catalog-header">
        <div
          className="apu-catalog-title-wrap"
          onClick={toggleCatalog}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleCatalog();
            }
          }}
          aria-expanded={isOpen}
          aria-controls="apu-catalog-content"
          title={isOpen ? "Haz clic para plegar el catálogo" : "Haz clic para desplegar el catálogo"}
        >
          <div className="apu-catalog-title-row">
            <span className="apu-catalog-title-icon" aria-hidden="true">📋</span>
            <strong>Catálogo de actividades APU</strong>
            <span className="apu-catalog-badge">{apuActivities.length} actividades</span>
          </div>
          <small>
            {isOpen
              ? "Busca o selecciona una actividad del catálogo para incorporarla al análisis."
              : "Haz clic para desplegar el catálogo y el buscador de actividades prediseñadas."}
          </small>
        </div>

        <div className="apu-catalog-header-actions">
          {isOpen && (
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
          )}

          <button
            type="button"
            className={`apu-catalog-toggle-btn ${isOpen ? "is-active" : ""}`}
            onClick={toggleCatalog}
            aria-expanded={isOpen}
            aria-controls="apu-catalog-content"
            title={isOpen ? "Ocultar catálogo de actividades" : "Mostrar catálogo de actividades"}
          >
            {isOpen ? (
              <>
                <span>Ocultar catálogo</span>
                <span aria-hidden="true">▲</span>
              </>
            ) : (
              <>
                <span>Explorar catálogo ({apuActivities.length})</span>
                <span aria-hidden="true">▼</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div id="apu-catalog-content" className="apu-catalog-body">
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
        </div>
      )}
    </section>
  );
}
