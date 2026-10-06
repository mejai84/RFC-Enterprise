"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apuCategoryMeta,
  apuCostTotal,
  apuEffectiveMarginPercent,
  apuProfitAmount,
  apuSellingTotal,
  apuTotal,
  archiveApuAnalysis,
  defaultApuMargins,
  getLaborPositionCatalog,
  lineSellingTotal,
  lineTotal,
  loadApuWorkspaceData,
  loadApuInventoryCatalog,
  publishApuToBoq,
  registerBoqCost,
  saveApuAnalysis,
  type Apu,
  type ApuActivity,
  type ApuCategory,
  type ApuCategoryMargins,
  type ApuLine,
  type LaborPosition,
  type LaborPositionCatalog,
  type ApuProject,
  type ProjectBoqCost,
  type ProjectBoqItem,
  defaultTransportCatalog,
  getTransportCatalog,
  persistTransportItem,
  removeTransportItem,
  type TransportCatalog,
  type TransportItem,
} from "@/modules/apu";
import { initialProjects as seedProjects, type StockProduct } from "@/modules/inventory";
import { ApuActivityCatalog } from "./apu-activity-catalog";
import { ApuLaborPicker } from "./apu-labor-picker";
import { ApuPrintModal } from "./apu-print-modal";
import { ApuResourcePicker } from "./apu-resource-picker";
import { ApuTransportPicker } from "./apu-transport-picker";

const categories: ApuCategory[] = ["equipment", "materials", "labor", "transport"];
const emptyLaborCatalog: LaborPositionCatalog = { positions: [], source: "fallback" };
const formatCOP = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const newId = () => crypto.randomUUID();
const parseDecimal = (value: string) => {
  const compact = value.trim().replace(/\s/g, "");
  const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

type QuoteContext = { quoteId?: string; quoteCode?: string; quoteTitle?: string; quoteStatus?: string };

export function ApuWorkspace({ quoteContext }: { quoteContext?: QuoteContext }) {
  const isQuoteApuReadOnly = Boolean(quoteContext?.quoteId && !["estimating", "revision_requested"].includes(quoteContext.quoteStatus ?? "estimating"));
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<{
    count: number;
    error?: string;
    loading: boolean;
  }>({ count: 0, loading: true });
  const [apus, setApus] = useState<Apu[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [laborCatalog, setLaborCatalog] = useState<LaborPositionCatalog>(emptyLaborCatalog);
  const [isLaborLoading, setIsLaborLoading] = useState(true);
  const [transportCatalog, setTransportCatalog] = useState<TransportCatalog>({ items: defaultTransportCatalog, source: "fallback" });
  const [isTransportLoading, setIsTransportLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "database" | "local" | "error">("idle");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ApuProject[]>([]);
  const [boqItems, setBoqItems] = useState<ProjectBoqItem[]>([]);
  const [boqCosts, setBoqCosts] = useState<ProjectBoqCost[]>([]);
  const [projectToLink, setProjectToLink] = useState("");
  const [costType, setCostType] = useState<ProjectBoqCost["costType"]>("committed");
  const [costAmount, setCostAmount] = useState("");
  const [costReference, setCostReference] = useState("");
  const [printingApu, setPrintingApu] = useState<Apu | null>(null);
  const selected = useMemo(() => apus.find((apu) => apu.id === selectedId), [apus, selectedId]);
  const visibleApus = useMemo(
    () => quoteContext?.quoteId ? apus.filter((apu) => apu.quoteId === quoteContext.quoteId) : apus,
    [apus, quoteContext],
  );
  /** Totales del análisis: suma de todas las actividades (no solo la seleccionada). */
  const analysisTotals = useMemo(() => {
    const quantity = visibleApus.reduce(
      (total, apu) => total + (Number(apu.workQuantity) || 0),
      0,
    );
    const cost = visibleApus.reduce((total, apu) => total + apuCostTotal(apu), 0);
    const profit = visibleApus.reduce((total, apu) => total + apuProfitAmount(apu), 0);
    const selling = visibleApus.reduce((total, apu) => total + apuSellingTotal(apu), 0);
    return {
      count: visibleApus.length,
      quantity,
      cost,
      profit,
      selling,
      unitCost: quantity > 0 ? cost / quantity : 0,
      unitSelling: quantity > 0 ? selling / quantity : 0,
      selectedSelling: selected ? apuSellingTotal(selected) : 0,
      selectedShare: selling > 0 && selected ? (apuSellingTotal(selected) / selling) * 100 : 0,
    };
  }, [visibleApus, selected]);

  useEffect(() => {
    let active = true;
    /** Fusiona listas de proyectos eliminando duplicados por id. */
    function mergeProjects(...sources: ApuProject[][]) {
      const map = new Map<string, ApuProject>();
      for (const list of sources) for (const p of list) if (!map.has(p.id)) map.set(p.id, p);
      return Array.from(map.values());
    }
    /** Carga proyectos desde localStorage e initialProjects como respaldo. */
    function loadFallbackProjects(): ApuProject[] {
      try {
        const stored = JSON.parse(localStorage.getItem("rfc_inventory_projects") || "[]") as Array<{ id: string; code?: string; name: string }>;
        return stored.filter((p) => p.id && p.name).map((p) => ({ id: p.id, code: p.code || "", name: p.name }));
      } catch { return []; }
    }
    const seedFallback: ApuProject[] = seedProjects.filter((p) => p.status === "active" || p.status === "pending").map((p) => ({ id: p.id, code: p.code, name: p.name }));
    /** Catálogo de inventario para materiales y equipos (viene de Supabase). */
    void loadApuInventoryCatalog().then((result) => {
      if (!active) return;
      setProducts(result.products);
      setCatalogStatus({
        count: result.products.length,
        error: result.error,
        loading: false,
      });
    });
    async function loadWorkspace() {
      try {
        const remote = await loadApuWorkspaceData();
        if (remote) {
          if (!active) return;
          setCompanyId(remote.companyId);
          // Fusionar proyectos remotos con locales + seed para que nunca quede vacío
          setProjects(mergeProjects(remote.projects));
          setBoqItems(remote.boqItems);
          setBoqCosts(remote.boqCosts);
          setApus(remote.apus);
          const visible = quoteContext?.quoteId ? remote.apus.filter((apu) => apu.quoteId === quoteContext.quoteId) : remote.apus;
          setSelectedId(visible[0]?.id || "");
          setSaveMessage("APUs cargados desde la base de datos.");
          return;
        }
        // Modo offline / sin Supabase
        if (!active) return;
        setProjects(mergeProjects(loadFallbackProjects(), seedFallback));
        const saved = JSON.parse(localStorage.getItem("rfc_apus") || "[]") as Apu[];
        setApus(saved);
        const visible = quoteContext?.quoteId ? saved.filter((apu) => apu.quoteId === quoteContext.quoteId) : saved;
        setSelectedId(visible[0]?.id || "");
      } catch {
        if (active) {
          setProjects(mergeProjects(loadFallbackProjects(), seedFallback));
          setSaveMessage("No fue posible cargar la base de datos; se muestra el respaldo de este dispositivo.");
        }
      }
    }
    void loadWorkspace();
    return () => { active = false; };
  }, [quoteContext?.quoteId]);

  useEffect(() => {
    let active = true;
    getLaborPositionCatalog()
      .then((catalog) => { if (active) setLaborCatalog(catalog); })
      .catch(() => {
        if (active) setLaborCatalog({ positions: [], source: "fallback", warning: "No fue posible cargar el catálogo de cargos. Intenta actualizar la página." });
      })
      .finally(() => { if (active) setIsLaborLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getTransportCatalog()
      .then((catalog) => { if (active) setTransportCatalog(catalog); })
      .catch(() => {
        if (active) setTransportCatalog({ items: defaultTransportCatalog, source: "fallback", warning: "Usando catálogo local de transporte." });
      })
      .finally(() => { if (active) setIsTransportLoading(false); });
    return () => { active = false; };
  }, []);

  function createApu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isQuoteApuReadOnly) { setSaveState("error"); setSaveMessage("Este APU se conserva en consulta porque la cotización ya no está en proceso o por modificar."); return; }
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
    if (isQuoteApuReadOnly) { setSaveState("error"); setSaveMessage("Este APU está en consulta. Solicite una revisión de cotización para editarlo."); return; }
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
    if (isQuoteApuReadOnly) { setSaveState("error"); setSaveMessage("El APU está bloqueado para edición en el estado actual de la cotización."); return; }
    setApus((current) => current.map((item) => item.id === apu.id ? { ...apu, updatedAt: new Date().toISOString() } : item));
    setSaveMessage("Hay cambios pendientes de guardar.");
  }

  function addLine(category: ApuCategory, product?: StockProduct) {
    if (!selected) return;
    const manualName = product ? undefined : window.prompt(`Nombre del recurso de ${apuCategoryMeta[category].label.toLocaleLowerCase("es-CO")}:`, category === "labor" ? "Nuevo cargo" : "Nuevo recurso")?.trim();
    if (!product && !manualName) return;
    const line: ApuLine = {
      id: newId(),
      category,
      name: product?.name || manualName || "Nuevo recurso",
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

  function addTransportItem(item: TransportItem) {
    if (!selected) return;
    const line: ApuLine = {
      id: newId(),
      category: "transport",
      name: item.name,
      quantity: 1,
      yieldPerDay: 1,
      dailyRate: item.defaultRate, // Instantánea de costo congelada e inmutable
      transportItemId: item.id,
      transportCode: item.code,
      unit: item.unit,
    };
    updateApu({ ...selected, lines: [...selected.lines, line] });
  }

  async function handleSaveTransportItem(item: Omit<TransportItem, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    if (isQuoteApuReadOnly) return;
    const saved = await persistTransportItem(companyId, item);
    setTransportCatalog((prev) => {
      const idx = prev.items.findIndex((i) => i.id === saved.id);
      const next = idx >= 0 ? prev.items.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...prev.items];
      return { ...prev, items: next };
    });
  }

  async function handleDeleteTransportItem(itemId: string) {
    if (isQuoteApuReadOnly) return;
    await removeTransportItem(companyId, itemId);
    setTransportCatalog((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId),
    }));
  }

  function updateLine(lineId: string, field: keyof ApuLine, value: string | number) {
    if (!selected) return;
    updateApu({ ...selected, lines: selected.lines.map((line) => line.id === lineId ? { ...line, [field]: value } : line) });
  }

  function updateMargin(category: ApuCategory, percent: number) {
    if (!selected) return;
    const currentMargins = selected.categoryMargins ?? { ...defaultApuMargins };
    updateApu({
      ...selected,
      categoryMargins: {
        ...currentMargins,
        [category]: Number.isNaN(percent) ? 0 : Math.max(0, percent),
      },
    });
  }

  function removeLine(lineId: string) {
    if (selected) updateApu({ ...selected, lines: selected.lines.filter((line) => line.id !== lineId) });
  }

  async function saveSelectedApu() {
    if (!selected) return;
    if (isQuoteApuReadOnly) { setSaveState("error"); setSaveMessage("El APU está en consulta y no puede guardarse con cambios. Cree una revisión para habilitar edición."); return; }
    setSaveState("saving");
    setSaveMessage(`Guardando ${selected.code}…`);
    try {
      if (companyId) {
        const saved = await saveApuAnalysis(companyId, selected);
        const next = { ...selected, versionId: saved.versionId, revision: saved.revision, updatedAt: new Date().toISOString() };
        const nextApus = apus.map((apu) => apu.id === next.id ? next : apu);
        setApus(nextApus);
        setSaveState("database");
        setSaveMessage(`${selected.code} guardado como versión ${saved.revision} en la base de datos.`);
      } else {
        setSaveState("error");
        setSaveMessage("No se guardó el APU: no fue posible identificar la empresa de tu sesión. Solicita al administrador asignarte una empresa y rol.");
      }
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "No fue posible guardar el APU.");
    }
  }

  async function deleteSelectedApu() {
    if (!selected || !window.confirm(`¿Eliminar únicamente ${selected.code} · ${selected.name}?`)) return;
    if (isQuoteApuReadOnly) { setSaveState("error"); setSaveMessage("El APU está en consulta y no puede eliminarse en el estado actual."); return; }
    try { if (companyId) await archiveApuAnalysis(selected.id); } catch (error) { setSaveMessage(error instanceof Error ? error.message : "No fue posible archivar el APU."); return; }
    const nextApus = apus.filter((apu) => apu.id !== selected.id);
    const nextVisible = quoteContext?.quoteId ? nextApus.filter((apu) => apu.quoteId === quoteContext.quoteId) : nextApus;
    setApus(nextApus);
    setSelectedId(nextVisible[0]?.id || "");
    setSaveMessage(`${selected.code} fue eliminado. Los demás APUs no se modificaron.`);
  }

  async function sendSelectedToBoq() {
    if (!selected || !projectToLink) return;
    if (isQuoteApuReadOnly) { setSaveState("error"); setSaveMessage("El APU está en consulta. El presupuesto de la obra se controla desde Obras y Proyectos."); return; }
    if (companyId) {
      try {
        await publishApuToBoq(companyId, selected, projectToLink);
        const remote = await loadApuWorkspaceData();
        if (remote) { setBoqItems(remote.boqItems); setBoqCosts(remote.boqCosts); }
        setSaveMessage(`${selected.code} quedó vinculado al presupuesto BOQ de la obra.`);
      } catch (error) {
        setSaveMessage(error instanceof Error ? error.message : "Guarda primero el APU para enviarlo al presupuesto.");
      }
    } else {
      // Sin conexión verificada: no guardar en localStorage; exigir sesión para persistir.
      setSaveState("error");
      setSaveMessage(`No fue posible guardar ${selected.code}: inicia sesión en RFC Enterprise para sincronizar con Supabase.`);
    }
  }

  async function addBoqCost(boqItemId: string) {
    if (!companyId || !costAmount || Number(costAmount) <= 0) return;
    if (isQuoteApuReadOnly) return;
    try {
      await registerBoqCost(companyId, boqItemId, costType, Number(costAmount), costReference);
      const remote = await loadApuWorkspaceData();
      if (remote) setBoqCosts(remote.boqCosts);
      setCostAmount(""); setCostReference("");
      setSaveMessage("Costo registrado en el control de la obra.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "No fue posible registrar el costo."); }
  }

  return (
    <main className={`dashboard-content apu-workspace ${isQuoteApuReadOnly ? "apu-workspace--readonly" : ""}`} id="main-content">
      <section className="dashboard-heading">
        <div><p>Costos · RFC Enterprise</p><h1>Análisis de Precios Unitarios</h1><small>Construye APUs por actividad y toma precios unitarios de Inventarios.</small></div>
      </section>
      {quoteContext?.quoteCode ? (
        <p className={`apu-quote-context ${isQuoteApuReadOnly ? "is-read-only" : ""}`}>{isQuoteApuReadOnly ? <>Estás consultando el APU de <strong>{quoteContext.quoteCode}</strong>. Se conserva como historial de la oferta; para modificarlo, crea una revisión de cotización.</> : <>Estás creando actividades para la cotización <strong>{quoteContext.quoteCode}</strong>. Guarda cada APU antes de volver a Cotizaciones.</>}</p>
      ) : null}
      <ApuActivityCatalog onCreate={createApuFromActivity} />
      <section className="apu-layout">
        <aside className="dashboard-panel apu-list">
          <div className="panel-title"><div><p>APUs</p><h2>{visibleApus.length} análisis</h2></div></div>
          <div className="apu-analysis-total" aria-label="Total del análisis">
            <span>Total de las {analysisTotals.count} actividades</span>
            <strong>{formatCOP(analysisTotals.selling)}</strong>
            <small>
              Costo {formatCOP(analysisTotals.cost)} · Ganancia +{formatCOP(analysisTotals.profit)}
            </small>
          </div>
          {visibleApus.map((apu) => (
            <button type="button" key={apu.id} className={`apu-row ${apu.id === selectedId ? "is-selected" : ""}`} onClick={() => setSelectedId(apu.id)}>
              <strong>{apu.code}</strong>
              <span>{apu.name}</span>
              <small>Venta: {formatCOP(apuSellingTotal(apu))}</small>
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
                <div>
                  <p>{selected.code} · {selected.unit}</p>
                  <h2>{selected.name}</h2>
                  <small>Cantidad de obra: {selected.workQuantity.toLocaleString("es-CO")} {selected.unit}</small>
                </div>
                <strong className="apu-total">
                  {formatCOP(apuSellingTotal(selected))}
                  <small>Precio de venta ({formatCOP(apuSellingTotal(selected) / selected.workQuantity)} / {selected.unit})</small>
                  <small className="apu-total-share">
                    {analysisTotals.selectedShare.toFixed(1)}% del total del análisis
                  </small>
                </strong>
              </div>
              <div className="apu-selected-toolbar">
                <label><span>Actividad</span><input value={selected.name} onChange={(event) => updateApu({ ...selected, name: event.target.value })} /></label>
                <label><span>Unidad</span><input value={selected.unit} onChange={(event) => updateApu({ ...selected, unit: event.target.value })} /></label>
                <label><span>Cantidad de obra</span><input type="number" min="0.01" step="any" value={selected.workQuantity} onChange={(event) => updateApu({ ...selected, workQuantity: Number(event.target.value) || 1 })} /></label>
              </div>
              <div className="apu-actions-bar" role="group" aria-label="Acciones del APU seleccionado">
                <button type="button" className="inventory-action apu-action-primary" onClick={() => void saveSelectedApu()} title="Guarda esta actividad en Supabase">
                  💾 Guardar APU
                </button>
                <button type="button" className="apu-print-btn apu-action-secondary" onClick={() => setPrintingApu(selected)} title="Abre el formato imprimible de esta actividad">
                  🖨️ Imprimir APU
                </button>
                <span className="apu-actions-spacer" />
                <button type="button" className="apu-delete-apu apu-action-danger" onClick={() => void deleteSelectedApu()} title="Elimina únicamente esta actividad; las demás no se modifican">
                  🗑️ Eliminar APU
                </button>
              </div>
              {saveMessage ? <p className={`apu-save-message is-${saveState}`} role="status" aria-live="polite">{saveMessage}</p> : null}

              {/* Panel de Márgenes por Rubro y Resumen Financiero */}
              <section className="apu-margins-panel" aria-label="Márgenes de ganancia por rubro">
                <div className="apu-margins-header">
                  <div>
                    <p>Márgenes de ganancia por rubro</p>
                    <small>Define el porcentaje adicional para cubrir imprevistos, mermas y utilidad comercial.</small>
                  </div>
                </div>
                <div className="apu-margins-grid">
                  {categories.map((cat) => {
                    const currentMargin = selected.categoryMargins?.[cat] ?? defaultApuMargins[cat];
                    return (
                      <div className="apu-margin-card" key={`margin-${cat}`}>
                        <label>{apuCategoryMeta[cat].label}</label>
                        <div className="apu-margin-input-wrap">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={currentMargin}
                            onChange={(e) => updateMargin(cat, parseFloat(e.target.value))}
                          />
                          <span>%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="apu-financial-summary">
                  <div className="apu-financial-card">
                    <p>Costo Directo Real</p>
                    <strong>{formatCOP(apuCostTotal(selected))}</strong>
                    <small>{formatCOP(apuCostTotal(selected) / selected.workQuantity)} / {selected.unit}</small>
                  </div>
                  <div className="apu-financial-card">
                    <p>Ganancia Estimada</p>
                    <strong>+{formatCOP(apuProfitAmount(selected))}</strong>
                    <small>+{apuEffectiveMarginPercent(selected).toFixed(1)}% margen global</small>
                  </div>
                  <div className="apu-financial-card is-selling">
                    <p>Precio Venta Cotizado</p>
                    <strong>{formatCOP(apuSellingTotal(selected))}</strong>
                    <small>{formatCOP(apuSellingTotal(selected) / selected.workQuantity)} / {selected.unit} (unitario)</small>
                  </div>
                </div>
              </section>

              {/* Resumen acumulado de TODAS las actividades del análisis */}
              <section className="apu-analysis-panel" aria-label="Resumen acumulado del análisis">
                <div className="apu-analysis-header">
                  <div>
                    <p>Resumen del análisis</p>
                    <small>Suma de las {analysisTotals.count} actividades de este análisis ({analysisTotals.quantity.toLocaleString("es-CO")} unidades totales).</small>
                  </div>
                </div>
                <div className="apu-analysis-grid">
                  <div className="apu-analysis-card">
                    <p>Costo Directo Real acumulado</p>
                    <strong>{formatCOP(analysisTotals.cost)}</strong>
                    <small>{formatCOP(analysisTotals.unitCost)} / unidad</small>
                  </div>
                  <div className="apu-analysis-card">
                    <p>Ganancia Estimada acumulada</p>
                    <strong>+{formatCOP(analysisTotals.profit)}</strong>
                    <small>Suma de todas las actividades</small>
                  </div>
                  <div className="apu-analysis-card is-selling">
                    <p>Precio de venta del análisis</p>
                    <strong>{formatCOP(analysisTotals.selling)}</strong>
                    <small>{formatCOP(analysisTotals.unitSelling)} / unidad ponderada</small>
                  </div>
                  <div className="apu-analysis-card">
                    <p>Participación de la actividad seleccionada</p>
                    <strong>{analysisTotals.selectedShare.toFixed(1)}%</strong>
                    <small>{formatCOP(analysisTotals.selectedSelling)} de {formatCOP(analysisTotals.selling)}</small>
                  </div>
                </div>
                {analysisTotals.count > 1 && (
                  <p className="apu-analysis-hint">
                    Este es el total que se lleva a la cotización y a la obra. El valor
                    grande arriba ({formatCOP(apuSellingTotal(selected))}) corresponde solo a
                    la actividad seleccionada.
                  </p>
                )}
              </section>

              <section className="apu-budget-control" aria-label="Presupuesto de obra">
                <div><p>Presupuesto BOQ y control de obra</p><h3>Vincular este APU al presupuesto</h3><small>{companyId ? "Guarda una versión y selecciónala como línea presupuestal de una obra." : "Modo local: selecciona una obra para vincular este APU."}</small></div>
                <div className="apu-budget-link"><select value={projectToLink} onChange={(event) => setProjectToLink(event.target.value)} aria-label="Obra destino"><option value="">Seleccione obra activa…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select><button type="button" onClick={() => void sendSelectedToBoq()} disabled={(!selected.versionId && !!companyId) || !projectToLink}>Enviar a presupuesto</button></div>
              </section>
              {companyId && boqItems.filter((item) => item.apuAnalysisId === selected.id).map((item) => {
                const committed = boqCosts.filter((cost) => cost.boqItemId === item.id && cost.costType === "committed").reduce((sum, cost) => sum + cost.amount, 0);
                const actual = boqCosts.filter((cost) => cost.boqItemId === item.id && cost.costType === "actual").reduce((sum, cost) => sum + cost.amount, 0);
                return <section className="apu-boq-status" key={item.id}><div><p>Control BOQ · {item.code}</p><h3>{item.description}</h3></div><dl><div><dt>Presupuestado</dt><dd>{formatCOP(item.budgetTotal)}</dd></div><div><dt>Comprometido</dt><dd>{formatCOP(committed)}</dd></div><div><dt>Real</dt><dd>{formatCOP(actual)}</dd></div><div><dt>Variación</dt><dd className={actual > item.budgetTotal ? "is-over" : ""}>{formatCOP(item.budgetTotal - actual)}</dd></div></dl><div className="apu-boq-entry"><select value={costType} onChange={(event) => setCostType(event.target.value as ProjectBoqCost["costType"])}><option value="committed">Comprometido</option><option value="actual">Real ejecutado</option></select><input type="number" min="0" step="any" value={costAmount} onChange={(event) => setCostAmount(event.target.value)} placeholder="Valor COP" aria-label="Valor del costo" /><input value={costReference} onChange={(event) => setCostReference(event.target.value)} placeholder="OC, factura o referencia" aria-label="Referencia del costo" /><button type="button" onClick={() => void addBoqCost(item.id)}>Registrar</button></div></section>;
              })}
              {categories.map((category) => {
                const lines = selected.lines.filter((line) => line.category === category);
                const inventoryChoices = category === "materials" || category === "equipment" ? products : [];
                const marginPercent = selected.categoryMargins?.[category] ?? defaultApuMargins[category];
                const costSubtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
                const sellingSubtotal = lines.reduce((sum, line) => sum + lineSellingTotal(line, selected.categoryMargins), 0);
                return (
                  <section className="apu-section" key={category}>
                    <header>
                      <div><h3>{apuCategoryMeta[category].label}</h3><small>{apuCategoryMeta[category].description}</small></div>
                      {category === "labor" ? (
                        <ApuLaborPicker catalog={laborCatalog} isLoading={isLaborLoading} onAdd={addLaborPosition} onAddManual={() => addLine("labor")} />
                      ) : category === "materials" || category === "equipment" ? (
                        <ApuResourcePicker
                          category={category}
                          products={inventoryChoices}
                          catalogLoading={catalogStatus.loading}
                          catalogError={catalogStatus.error}
                          onAdd={(product) => addLine(category, product)}
                        />
                      ) : (
                        <ApuTransportPicker
                          catalog={transportCatalog}
                          isLoading={isTransportLoading}
                          onAdd={addTransportItem}
                          onAddManual={() => addLine("transport")}
                          onSaveItem={handleSaveTransportItem}
                          onDeleteItem={handleDeleteTransportItem}
                        />
                      )}
                    </header>
                    {(category === "materials" || category === "equipment") && !inventoryChoices.length ? (
                      <p className="apu-resource-note">Este recurso aún no está en Inventarios. Agrégalo manualmente con su nombre, unidad y tarifa; quedará solo en este APU hasta que se registre formalmente en el catálogo.</p>
                    ) : null}
                    <div className="apu-table-wrap">
                      <table>
                        <thead><tr><th>Recurso</th><th>Cant.</th><th>Rend./día</th><th>Tarifa base</th><th>Costo base</th><th>Venta (+{marginPercent}%)</th><th /></tr></thead>
                        <tbody>
                          {lines.length ? lines.map((line) => (
                            <tr key={line.id}>
                              <td>
                                <strong>{line.name}</strong>
                                {line.inventoryProductId ? <small>Inventario · {line.unit || "unidad"}</small> : null}
                                {line.laborPositionId ? <small>{line.laborCode} · Nivel {line.laborLevel} · {line.laborActivityType === "propias" ? "Actividad propia" : "Actividad no propia"}</small> : null}
                                {line.transportItemId ? <small>Transporte · {line.transportCode || "Flete"} · {line.unit || "viaje"}</small> : null}
                              </td>
                              <td><input type="text" inputMode="decimal" defaultValue={line.quantity} onBlur={(event) => updateLine(line.id, "quantity", parseDecimal(event.target.value))} aria-label={`Cantidad de ${line.name}`} /></td>
                              <td><input type="text" inputMode="decimal" defaultValue={line.yieldPerDay} onBlur={(event) => updateLine(line.id, "yieldPerDay", parseDecimal(event.target.value))} aria-label={`Rendimiento diario de ${line.name}`} /></td>
                              <td><input type="text" inputMode="decimal" defaultValue={line.dailyRate} onBlur={(event) => updateLine(line.id, "dailyRate", parseDecimal(event.target.value))} aria-label={`Tarifa base de ${line.name}`} /></td>
                              <td>{formatCOP(lineTotal(line))}</td>
                              <td><strong>{formatCOP(lineSellingTotal(line, selected.categoryMargins))}</strong></td>
                              <td><button className="apu-remove" aria-label={`Eliminar ${line.name}`} type="button" onClick={() => removeLine(line.id)}>×</button></td>
                            </tr>
                          )) : <tr><td colSpan={7}>Aún no hay recursos en este rubro.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <footer>
                      <div className="apu-section-footer-breakdown">
                        <span className="apu-footer-cost">Costo base: <strong>{formatCOP(costSubtotal)}</strong></span>
                        <span className="apu-footer-selling">
                          Venta cotizada (+{marginPercent}%): <strong>{formatCOP(sellingSubtotal)}</strong>
                          <span className="apu-footer-badge">+{formatCOP(sellingSubtotal - costSubtotal)}</span>
                        </span>
                      </div>
                    </footer>
                  </section>
                );
              })}
            </>
          ) : <p className="panel-intro">Crea un APU para empezar a registrar recursos y costos.</p>}
        </section>
      </section>
      {printingApu ? <ApuPrintModal apu={printingApu} onClose={() => setPrintingApu(null)} /> : null}
    </main>
  );
}
