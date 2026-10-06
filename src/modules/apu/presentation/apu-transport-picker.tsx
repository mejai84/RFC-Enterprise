"use client";

import { useId, useMemo, useState } from "react";
import {
  transportCategoryLabels,
  type TransportCatalog,
  type TransportCategory,
  type TransportItem,
  type TransportUnit,
} from "../domain/transport";
import { rankItems } from "../domain/search-utils";

const formatCOP = (value: number) =>
  value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Props = {
  catalog: TransportCatalog;
  isLoading: boolean;
  onAdd: (item: TransportItem) => void;
  onAddManual: () => void;
  onSaveItem: (item: Omit<TransportItem, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
};

export function ApuTransportPicker({
  catalog,
  isLoading,
  onAdd,
  onAddManual,
  onSaveItem,
  onDeleteItem,
}: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | TransportCategory>("all");
  const [selectedId, setSelectedId] = useState("");
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<TransportItem> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectId = useId();

  // Filtrar y ordenar los ítems con ranking por relevancia
  const matches = useMemo(() => {
    let pool = catalog.items;
    if (categoryFilter !== "all") {
      pool = pool.filter((item) => item.category === categoryFilter);
    }
    if (!query.trim()) return pool;

    return rankItems(
      pool,
      query,
      (item) => item.name,
      (item) => `${item.categoryLabel} ${item.code} ${item.capacity || ""} ${item.description || ""}`
    );
  }, [catalog.items, categoryFilter, query]);

  const selected = catalog.items.find((item) => item.id === selectedId);
  const showResults = isOpen && !isLoading && matches.length > 0;
  const visibleMatches = matches.slice(0, 40);

  function pick(item: TransportItem) {
    setSelectedId(item.id);
    onAdd(item);
    setQuery("");
    setIsOpen(false);
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingItem?.name || !editingItem.defaultRate) return;
    setIsSaving(true);
    try {
      const code = editingItem.code || `TR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      await onSaveItem({
        id: editingItem.id,
        code,
        name: editingItem.name.trim(),
        category: (editingItem.category as TransportCategory) || "carga_pesada",
        categoryLabel: transportCategoryLabels[editingItem.category as TransportCategory] || "Transporte",
        unit: (editingItem.unit as TransportUnit) || "viaje",
        defaultRate: Number(editingItem.defaultRate) || 0,
        capacity: editingItem.capacity?.trim() || "",
        description: editingItem.description?.trim() || "",
        isActive: true,
      });
      setNotice(editingItem.id ? "Transporte actualizado exitosamente." : "Transporte agregado al catálogo.");
      setEditingItem(null);
    } catch {
      setNotice("No fue posible guardar el transporte en la base de datos.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(item: TransportItem) {
    if (!window.confirm(`¿Deseas retirar "${item.name}" del catálogo activo? Los APUs anteriores no serán alterados.`)) {
      return;
    }
    try {
      await onDeleteItem(item.id);
      if (selectedId === item.id) setSelectedId("");
      setNotice(`"${item.name}" retirado del catálogo.`);
    } catch {
      setNotice("No se pudo eliminar el transporte.");
    }
  }

  return (
    <div className="apu-labor-picker apu-transport-picker">
      <div className="apu-labor-controls apu-transport-controls">
        <label className="apu-labor-search">
          <span>Buscar transporte</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId("");
              setIsOpen(true);
            }}
            aria-autocomplete="list"
            aria-controls={selectId}
            aria-expanded={showResults}
            aria-label="Buscar transporte en el catálogo"
            placeholder={isLoading ? "Cargando transportes…" : "Ej. volqueta, cama baja, buseta, 4x4…"}
            disabled={isLoading}
            onFocus={() => setIsOpen(true)}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Escape") setIsOpen(false); }}
          />
          {query.trim() ? (
            <button
              type="button"
              className="apu-clear-search"
              onClick={() => {
                setQuery("");
                setSelectedId("");
              }}
              aria-label="Limpiar búsqueda de transporte"
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          ) : null}
        </label>

        <label>
          <span>Categoría</span>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as typeof categoryFilter);
              setSelectedId("");
            }}
          >
            <option value="all">Todas las categorías</option>
            <option value="carga_pesada">Carga pesada / Cama baja</option>
            <option value="volquetas">Volquetas / Acarreos</option>
            <option value="transporte_personal">Transporte de personal</option>
            <option value="vehiculos_livianos">Vehículos livianos 4x4</option>
            <option value="fluvial_especial">Fluvial y especial</option>
          </select>
        </label>

        <div className="apu-labor-actions">
          <button
            type="button"
            onClick={() => { setQuery(""); setIsOpen(true); }}
            title="Ver todo el catálogo de transportes"
          >
            Ver todos ({catalog.items.length})
          </button>

          <button
            type="button"
            className="apu-secondary-action"
            onClick={onAddManual}
            title="Agregar un flete no catalogado para esta actividad"
          >
            + Manual
          </button>

          <button
            type="button"
            className="apu-manage-catalog-btn"
            onClick={() => {
              setShowManageModal(true);
              setNotice(null);
            }}
            title="Administrar tarifas, editar o crear nuevos vehículos de transporte"
          >
            ⚙️ Catálogo
          </button>
        </div>
      </div>

      {/* Estado del catálogo y fuente de datos */}
      <div className="apu-labor-status" aria-live="polite">
        <span className={`apu-source-badge is-${catalog.source}`}>
          {catalog.source === "database" ? "Base de datos oficial" : "Respaldo local"}
        </span>
        <small>
          {matches.length === catalog.items.length
            ? `${catalog.items.length} vehículos y fletes en catálogo`
            : `${matches.length} de ${catalog.items.length} unidades coinciden`}
        </small>
        {matches.length === 0 && catalog.items.length > 0 ? (
          <small className="apu-filter-empty">Sin coincidencias: ajuste la búsqueda o quite el filtro de categoría.</small>
        ) : null}
        {notice ? <span className="apu-notice-inline">✓ {notice}</span> : null}
      </div>

      {showResults && (
        <div className="apu-resource-results" id={selectId} role="listbox" aria-label="Transportes encontrados">
          <p className="apu-resource-count" aria-live="polite">
            {matches.length} coincidencia{matches.length === 1 ? "" : "s"}
          </p>
          {visibleMatches.map((item) => (
            <button
              key={item.id}
              role="option"
              type="button"
              aria-selected={selectedId === item.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(item)}
            >
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.categoryLabel}
                  {item.capacity ? ` · ${item.capacity}` : ""}
                </small>
              </span>
              <b>{formatCOP(item.defaultRate)} / {item.unit}</b>
            </button>
          ))}
          {matches.length > visibleMatches.length ? (
            <p className="apu-resource-hint">
              Se muestran {visibleMatches.length} de {matches.length}. Afine la búsqueda para ver más.
            </p>
          ) : null}
        </div>
      )}

      {/* Detalle visual del transporte seleccionado */}
      {selected ? (
        <div className="apu-labor-detail apu-transport-detail">
          <strong>{selected.code} · {selected.name}</strong>
          <span>Tarifa base: <strong>{formatCOP(selected.defaultRate)}</strong> por {selected.unit}</span>
          {selected.capacity ? <span>Capacidad: {selected.capacity}</span> : null}
          {selected.description ? <small>{selected.description}</small> : null}
        </div>
      ) : null}

      {/* ── MODAL DE ADMINISTRACIÓN DE CATÁLOGO (CRUD COMPLETO) ── */}
      {showManageModal && (
        <div className="quote-modal-backdrop" onClick={() => setShowManageModal(false)} role="dialog">
          <div className="quote-modal apu-transport-manage-modal" onClick={(e) => e.stopPropagation()}>
            <header className="quote-modal-header">
              <div>
                <h2>Catálogo Maestro de Transportes y Fletes</h2>
                <p>
                  Administra las unidades de transporte y tarifas de referencia.
                  <strong> Los APUs anteriores conservan su valor histórico intacto.</strong>
                </p>
              </div>
              <button className="quote-modal-close" onClick={() => setShowManageModal(false)}>
                ✕
              </button>
            </header>

            {notice ? <div className="apu-save-message" style={{ margin: "10px 0" }}>{notice}</div> : null}

            {/* Formulario de Creación / Edición */}
            <form onSubmit={handleFormSubmit} className="apu-transport-form">
              <h3>{editingItem?.id ? "Editar Transporte" : "Nuevo Vehículo / Flete de Transporte"}</h3>
              <div className="apu-transport-form-grid">
                <label>
                  <span>Nombre / Descripción</span>
                  <input
                    required
                    placeholder="Ej. Cama Baja 40 Ton, Volqueta 15m³, Camioneta 4x4"
                    value={editingItem?.name || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                </label>

                <label>
                  <span>Categoría</span>
                  <select
                    value={editingItem?.category || "carga_pesada"}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as TransportCategory })}
                  >
                    <option value="carga_pesada">Carga pesada / Cama baja / Maquinaria</option>
                    <option value="volquetas">Volquetas y acarreo de materiales</option>
                    <option value="transporte_personal">Transporte de personal y cuadrillas</option>
                    <option value="vehiculos_livianos">Vehículos livianos y utilitarios 4x4</option>
                    <option value="fluvial_especial">Transporte fluvial y logística especial</option>
                  </select>
                </label>

                <label>
                  <span>Unidad de Costeo</span>
                  <select
                    value={editingItem?.unit || "viaje"}
                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value as TransportUnit })}
                  >
                    <option value="viaje">viaje</option>
                    <option value="día">día</option>
                    <option value="mes">mes</option>
                    <option value="hora">hora</option>
                    <option value="km">km</option>
                    <option value="gl">gl (global)</option>
                  </select>
                </label>

                <label>
                  <span>Tarifa Referencial (COP)</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    placeholder="Ej. 1850000"
                    value={editingItem?.defaultRate || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, defaultRate: Number(e.target.value) || 0 })}
                  />
                </label>

                <label>
                  <span>Capacidad Operativa</span>
                  <input
                    placeholder="Ej. 30 Toneladas, 15 m³, 28 Pasajeros"
                    value={editingItem?.capacity || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, capacity: e.target.value })}
                  />
                </label>

                <label>
                  <span>Código Interno (opcional)</span>
                  <input
                    placeholder="Ej. TR-CB-30T"
                    value={editingItem?.code || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })}
                  />
                </label>
              </div>

              <div className="apu-transport-form-actions">
                <button type="submit" disabled={isSaving} className="inventory-action">
                  {isSaving ? "Guardando…" : editingItem?.id ? "Actualizar Transporte" : "+ Agregar al Catálogo"}
                </button>
                {editingItem?.id ? (
                  <button type="button" className="apu-secondary-action" onClick={() => setEditingItem(null)}>
                    Cancelar Edición
                  </button>
                ) : null}
              </div>
            </form>

            {/* Tabla de Transportes en Catálogo */}
            <div className="apu-transport-table-wrap">
              <table className="apu-transport-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Transporte</th>
                    <th>Categoría</th>
                    <th>Unidad</th>
                    <th>Tarifa COP</th>
                    <th>Capacidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.items.map((item) => (
                    <tr key={item.id}>
                      <td><code>{item.code}</code></td>
                      <td><strong>{item.name}</strong></td>
                      <td><small>{item.categoryLabel}</small></td>
                      <td><span className="badge-unit">{item.unit}</span></td>
                      <td><strong>{formatCOP(item.defaultRate)}</strong></td>
                      <td><small>{item.capacity || "—"}</small></td>
                      <td>
                        <div className="table-actions-row">
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => setEditingItem(item)}
                            title="Editar nombre, unidad o tarifa"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => handleDelete(item)}
                            title="Retirar del catálogo activo"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
