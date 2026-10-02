"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apuCategoryMeta,
  apuTotal,
  getLaborPositionCatalog,
  lineTotal,
  type Apu,
  type ApuActivity,
  type ApuCategory,
  type ApuLine,
  type LaborPosition,
  type LaborPositionCatalog,
} from "@/modules/apu";
import type { StockProduct } from "@/modules/inventory";
import { ApuActivityCatalog } from "./apu-activity-catalog";
import { ApuLaborPicker } from "./apu-labor-picker";

const categories: ApuCategory[] = ["equipment", "materials", "labor", "transport"];
const emptyLaborCatalog: LaborPositionCatalog = { positions: [], source: "fallback" };
const formatCOP = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const newId = () => crypto.randomUUID();

type QuoteContext = { quoteId?: string; quoteCode?: string; quoteTitle?: string };

export function ApuWorkspace({ quoteContext }: { quoteContext?: QuoteContext }) {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [apus, setApus] = useState<Apu[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [laborCatalog, setLaborCatalog] = useState<LaborPositionCatalog>(emptyLaborCatalog);
  const [isLaborLoading, setIsLaborLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const selected = useMemo(() => apus.find((apu) => apu.id === selectedId), [apus, selectedId]);
  const visibleApus = useMemo(
    () => quoteContext?.quoteId ? apus.filter((apu) => apu.quoteId === quoteContext.quoteId) : apus,
    [apus, quoteContext?.quoteId],
  );

  useEffect(() => {
    try {
      setProducts(JSON.parse(localStorage.getItem("rfc_inventory_products") || "[]"));
      const saved = JSON.parse(localStorage.getItem("rfc_apus") || "[]") as Apu[];
      setApus(saved);
      const visible = quoteContext?.quoteId ? saved.filter((apu) => apu.quoteId === quoteContext.quoteId) : saved;
      setSelectedId(visible[0]?.id || "");
    } catch {
      setSaveMessage("No fue posible leer los APUs guardados en este dispositivo.");
    }
  }, [quoteContext?.quoteId]);

  useEffect(() => {
    let active = true;
    getLaborPositionCatalog().then((catalog) => {
      if (!active) return;
      setLaborCatalog(catalog);
      setIsLaborLoading(false);
    });
    return () => { active = false; };
  }, []);

  function createApu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const apu: Apu = {
      id: newId(),
      code: `APU-${String(apus.length + 1).padStart(3, "0")}`,
      name: String(data.get("name") || quoteContext?.quoteTitle || "Nuevo APU"),
      unit: String(data.get("unit") || "und"),
      workQuantity: Number(data.get("quantity")) || 1,
      lines: [],
      quoteId: quoteContext?.quoteId,
      quoteCode: quoteContext?.quoteCode,
      createdAt: now,
      updatedAt: now,
    };
    setApus((current) => [apu, ...current]);
    setSelectedId(apu.id);
    setSaveMessage("APU creado. Agrega los recursos y pulsa Guardar APU.");
    event.currentTarget.reset();
  }

  function createApuFromActivity(activity: ApuActivity) {
    const now = new Date().toISOString();
    const apu: Apu = {
      id: newId(),
      code: `APU-${String(apus.length + 1).padStart(3, "0")}`,
      name: activity.name,
      unit: activity.unit,
      workQuantity: 1,
      lines: [],
      quoteId: quoteContext?.quoteId,
      quoteCode: quoteContext?.quoteCode,
      createdAt: now,
      updatedAt: now,
    };
    setApus((current) => [apu, ...current]);
    setSelectedId(apu.id);
    setSaveMessage("APU creado desde el catálogo. Pulsa Guardar APU al terminar.");
  }

  function updateApu(apu: Apu) {
    setApus((current) => current.map((item) => item.id === apu.id ? { ...apu, updatedAt: new Date().toISOString() } : item));
    setSaveMessage("Hay cambios pendientes de guardar.");
  }

  function addLine(category: ApuCategory, product?: StockProduct) {
    if (!selected) return;
    const line: ApuLine = {
      id: newId(),
      category,
      name: product?.name || (category === "labor" ? "Nuevo cargo" : "Nuevo recurso"),
      quantity: 1,
      yieldPerDay: 1,
      dailyRate: product?.unitCost || 0,
      inventoryProductId: product?.id,
      unit: product?.unit,
    };
    updateApu({ ...selected, lines: [...selected.lines, line] });
  }

  function addLaborPosition(position: LaborPosition) {
    if (!selected) return;
    const line: ApuLine = {
      id: newId(),
      category: "labor",
      name: position.name,
      quantity: 1,
      yieldPerDay: 1,
      dailyRate: position.totalDailyRate,
      laborPositionId: position.id,
      laborCode: position.code,
      laborLevel: position.level,
      laborActivityType: position.activityType,
      unit: "día",
    };
    updateApu({ ...selected, lines: [...selected.lines, line] });
  }

  function updateLine(lineId: string, field: keyof ApuLine, value: string | number) {
    if (!selected) return;
    updateApu({ ...selected, lines: selected.lines.map((line) => line.id === lineId ? { ...line, [field]: value } : line) });
  }

  function removeLine(lineId: string) {
    if (selected) updateApu({ ...selected, lines: selected.lines.filter((line) => line.id !== lineId) });
  }

  function saveSelectedApu() {
    if (!selected) return;
    localStorage.setItem("rfc_apus", JSON.stringify(apus));
    setSaveMessage(`${selected.code} guardado correctamente a las ${new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}.`);
  }

  function deleteSelectedApu() {
    if (!selected || !window.confirm(`¿Eliminar únicamente ${selected.code} · ${selected.name}?`)) return;
    const nextApus = apus.filter((apu) => apu.id !== selected.id);
    const nextVisible = quoteContext?.quoteId ? nextApus.filter((apu) => apu.quoteId === quoteContext.quoteId) : nextApus;
    setApus(nextApus);
    setSelectedId(nextVisible[0]?.id || "");
    localStorage.setItem("rfc_apus", JSON.stringify(nextApus));
    setSaveMessage(`${selected.code} fue eliminado. Los demás APUs no se modificaron.`);
  }

  return (
    <main className="dashboard-content apu-workspace" id="main-content">
      <section className="dashboard-heading">
        <div><p>Costos · RFC Enterprise</p><h1>Análisis de Precios Unitarios</h1><small>Construye APUs por actividad y toma precios unitarios de Inventarios.</small></div>
      </section>
      {quoteContext?.quoteCode ? (
        <p className="apu-quote-context">Estás creando actividades para la cotización <strong>{quoteContext.quoteCode}</strong>. Guarda cada APU antes de volver a Cotizaciones.</p>
      ) : null}
      <ApuActivityCatalog onCreate={createApuFromActivity} />
      <section className="apu-layout">
        <aside className="dashboard-panel apu-list">
          <div className="panel-title"><div><p>APUs</p><h2>{visibleApus.length} análisis</h2></div></div>
          {visibleApus.map((apu) => (
            <button type="button" key={apu.id} className={`apu-row ${apu.id === selectedId ? "is-selected" : ""}`} onClick={() => setSelectedId(apu.id)}>
              <strong>{apu.code}</strong><span>{apu.name}</span><small>{formatCOP(apuTotal(apu))}</small>
            </button>
          ))}
          <form className="apu-new-form" onSubmit={createApu}>
            <input name="name" required placeholder="Actividad: trazado y replanteo" />
            <div><input name="unit" defaultValue="m²" aria-label="Unidad" /><input name="quantity" type="number" min="0.01" step="any" defaultValue="1" aria-label="Cantidad de obra" /></div>
            <button className="inventory-action" type="submit">Nuevo APU</button>
          </form>
        </aside>
        <section className="dashboard-panel apu-editor">
          {selected ? (
            <>
              <div className="panel-title apu-editor-heading">
                <div><p>{selected.code} · {selected.unit}</p><h2>{selected.name}</h2><small>Cantidad de obra: {selected.workQuantity.toLocaleString("es-CO")} {selected.unit}</small></div>
                <strong className="apu-total">{formatCOP(apuTotal(selected))}<small>{formatCOP(apuTotal(selected) / selected.workQuantity)} / {selected.unit}</small></strong>
              </div>
              <div className="apu-selected-toolbar">
                <label><span>Actividad</span><input value={selected.name} onChange={(event) => updateApu({ ...selected, name: event.target.value })} /></label>
                <label><span>Unidad</span><input value={selected.unit} onChange={(event) => updateApu({ ...selected, unit: event.target.value })} /></label>
                <label><span>Cantidad de obra</span><input type="number" min="0.01" step="any" value={selected.workQuantity} onChange={(event) => updateApu({ ...selected, workQuantity: Number(event.target.value) || 1 })} /></label>
                <div className="apu-selected-actions"><button type="button" className="inventory-action" onClick={saveSelectedApu}>Guardar APU</button><button type="button" className="apu-delete-apu" onClick={deleteSelectedApu}>Eliminar este APU</button></div>
              </div>
              {saveMessage ? <p className="apu-save-message" role="status">{saveMessage}</p> : null}
              {categories.map((category) => {
                const lines = selected.lines.filter((line) => line.category === category);
                const inventoryChoices = category === "materials" || category === "equipment" ? products : [];
                return (
                  <section className="apu-section" key={category}>
                    <header>
                      <div><h3>{apuCategoryMeta[category].label}</h3><small>{apuCategoryMeta[category].description}</small></div>
                      {category === "labor" ? (
                        <ApuLaborPicker catalog={laborCatalog} isLoading={isLaborLoading} onAdd={addLaborPosition} onAddManual={() => addLine("labor")} />
                      ) : (
                        <div className="apu-add">
                          <select aria-label={`Añadir ${apuCategoryMeta[category].label}`} defaultValue="">
                            <option value="">{inventoryChoices.length ? "Añadir desde inventario…" : "Recurso manual"}</option>
                            {inventoryChoices.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatCOP(product.unitCost || 0)}</option>)}
                          </select>
                          <button type="button" onClick={(event) => {
                            const select = event.currentTarget.previousElementSibling as HTMLSelectElement;
                            addLine(category, products.find((product) => product.id === select.value));
                          }}>Agregar</button>
                        </div>
                      )}
                    </header>
                    <div className="apu-table-wrap">
                      <table>
                        <thead><tr><th>Recurso</th><th>Cant.</th><th>Rend./día</th><th>Tarifa</th><th>Parcial</th><th /></tr></thead>
                        <tbody>
                          {lines.length ? lines.map((line) => (
                            <tr key={line.id}>
                              <td><strong>{line.name}</strong>{line.inventoryProductId ? <small>Inventario · {line.unit || "unidad"}</small> : null}{line.laborPositionId ? <small>{line.laborCode} · Nivel {line.laborLevel} · {line.laborActivityType === "propias" ? "Actividad propia" : "Actividad no propia"}</small> : null}</td>
                              <td><input type="number" min="0" step="any" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", Number(event.target.value))} /></td>
                              <td><input type="number" min="0" step="any" value={line.yieldPerDay} onChange={(event) => updateLine(line.id, "yieldPerDay", Number(event.target.value))} /></td>
                              <td><input type="number" min="0" step="any" value={line.dailyRate} onChange={(event) => updateLine(line.id, "dailyRate", Number(event.target.value))} /></td>
                              <td><strong>{formatCOP(lineTotal(line))}</strong></td>
                              <td><button className="apu-remove" aria-label={`Eliminar ${line.name}`} type="button" onClick={() => removeLine(line.id)}>×</button></td>
                            </tr>
                          )) : <tr><td colSpan={6}>Aún no hay recursos en este rubro.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <footer>Subtotal {apuCategoryMeta[category].label}: <strong>{formatCOP(lines.reduce((sum, line) => sum + lineTotal(line), 0))}</strong></footer>
                  </section>
                );
              })}
            </>
          ) : <p className="panel-intro">Crea un APU para empezar a registrar recursos y costos.</p>}
        </section>
      </section>
    </main>
  );
}
