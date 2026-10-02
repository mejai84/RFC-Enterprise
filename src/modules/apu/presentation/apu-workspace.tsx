"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apuCategoryMeta,
  apuTotal,
  archiveApuAnalysis,
  getLaborPositionCatalog,
  lineTotal,
  loadApuWorkspaceData,
  publishApuToBoq,
  registerBoqCost,
  saveApuAnalysis,
  type Apu,
  type ApuActivity,
  type ApuCategory,
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

type QuoteContext = { quoteId?: string; quoteCode?: string; quoteTitle?: string };

export function ApuWorkspace({ quoteContext }: { quoteContext?: QuoteContext }) {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [apus, setApus] = useState<Apu[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [laborCatalog, setLaborCatalog] = useState<LaborPositionCatalog>(emptyLaborCatalog);
  const [isLaborLoading, setIsLaborLoading] = useState(true);
  const [transportCatalog, setTransportCatalog] = useState<TransportCatalog>({ items: defaultTransportCatalog, source: "fallback" });
  const [isTransportLoading, setIsTransportLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
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
    [apus, quoteContext?.quoteId],
  );

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
    async function loadWorkspace() {
      try {
        setProducts(JSON.parse(localStorage.getItem("rfc_inventory_products") || "[]"));
        const remote = await loadApuWorkspaceData();
        if (remote) {
          if (!active) return;
          setCompanyId(remote.companyId);
          // Fusionar proyectos remotos con locales + seed para que nunca quede vacío
          setProjects(mergeProjects(remote.projects, loadFallbackProjects(), seedFallback));
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

  async function handleSaveTransportItem(item: Omit<TransportItem, "createdAt" | "updatedAt"> & { id?: string }) {
    const saved = await persistTransportItem(companyId, item);
    setTransportCatalog((prev) => {
      const idx = prev.items.findIndex((i) => i.id === saved.id);
      const next = idx >= 0 ? prev.items.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...prev.items];
      return { ...prev, items: next };
    });
  }

  async function handleDeleteTransportItem(itemId: string) {
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

  function removeLine(lineId: string) {
    if (selected) updateApu({ ...selected, lines: selected.lines.filter((line) => line.id !== lineId) });
  }

  async function saveSelectedApu() {
    if (!selected) return;
    try {
      if (companyId) {
        const saved = await saveApuAnalysis(companyId, selected);
        const next = { ...selected, versionId: saved.versionId, revision: saved.revision, updatedAt: new Date().toISOString() };
        setApus((current) => current.map((apu) => apu.id === next.id ? next : apu));
        localStorage.setItem("rfc_apus", JSON.stringify(apus.map((apu) => apu.id === next.id ? next : apu)));
        setSaveMessage(`${selected.code} guardado como versión ${saved.revision} en la base de datos.`);
      } else {
        localStorage.setItem("rfc_apus", JSON.stringify(apus));
        setSaveMessage(`${selected.code} guardado localmente. Inicia sesión para crear versiones en la base de datos.`);
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "No fue posible guardar el APU.");
    }
  }

  async function deleteSelectedApu() {
    if (!selected || !window.confirm(`¿Eliminar únicamente ${selected.code} · ${selected.name}?`)) return;
    try { if (companyId) await archiveApuAnalysis(selected.id); } catch (error) { setSaveMessage(error instanceof Error ? error.message : "No fue posible archivar el APU."); return; }
    const nextApus = apus.filter((apu) => apu.id !== selected.id);
    const nextVisible = quoteContext?.quoteId ? nextApus.filter((apu) => apu.quoteId === quoteContext.quoteId) : nextApus;
    setApus(nextApus);
    setSelectedId(nextVisible[0]?.id || "");
    localStorage.setItem("rfc_apus", JSON.stringify(nextApus));
    setSaveMessage(`${selected.code} fue eliminado. Los demás APUs no se modificaron.`);
  }

  async function sendSelectedToBoq() {
    if (!selected || !projectToLink) return;
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
      // Modo local: guardar en localStorage
      const boqItem: ProjectBoqItem = {
        id: crypto.randomUUID(),
        projectId: projectToLink,
        apuAnalysisId: selected.id,
        apuVersionId: selected.versionId || selected.id,
        code: selected.code,
        description: selected.name,
        unit: selected.unit,
        contractQuantity: selected.workQuantity,
        budgetTotal: apuTotal(selected),
        status: "active",
      };
      const prev = JSON.parse(localStorage.getItem("rfc_apu_boq_items") || "[]") as ProjectBoqItem[];
      const next = [...prev.filter((i) => !(i.projectId === projectToLink && i.apuAnalysisId === selected.id)), boqItem];
      localStorage.setItem("rfc_apu_boq_items", JSON.stringify(next));
      setBoqItems(next);
      setSaveMessage(`${selected.code} vinculado localmente al presupuesto. Inicia sesión para sincronizar.`);
    }
  }

  async function addBoqCost(boqItemId: string) {
    if (!companyId || !costAmount || Number(costAmount) <= 0) return;
    try {
      await registerBoqCost(companyId, boqItemId, costType, Number(costAmount), costReference);
      const remote = await loadApuWorkspaceData();
      if (remote) setBoqCosts(remote.boqCosts);
      setCostAmount(""); setCostReference("");
      setSaveMessage("Costo registrado en el control de la obra.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "No fue posible registrar el costo."); }
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
                <div className="apu-selected-actions"><button type="button" className="inventory-action" onClick={() => void saveSelectedApu()}>Guardar APU</button><button type="button" className="apu-print-btn" onClick={() => setPrintingApu(selected)}>🖨️ Imprimir APU</button><button type="button" className="apu-delete-apu" onClick={() => void deleteSelectedApu()}>Eliminar este APU</button></div>
              </div>
              {saveMessage ? <p className="apu-save-message" role="status">{saveMessage}</p> : null}
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
                        <thead><tr><th>Recurso</th><th>Cant.</th><th>Rend./día</th><th>Tarifa</th><th>Parcial</th><th /></tr></thead>
                        <tbody>
                          {lines.length ? lines.map((line) => (
                            <tr key={line.id}>
                              <td>
                                <strong>{line.name}</strong>
                                {line.inventoryProductId ? <small>Inventario · {line.unit || "unidad"}</small> : null}
                                {line.laborPositionId ? <small>{line.laborCode} · Nivel {line.laborLevel} · {line.laborActivityType === "propias" ? "Actividad propia" : "Actividad no propia"}</small> : null}
                                {line.transportItemId ? <small>Transporte · {line.transportCode || "Flete"} · {line.unit || "viaje"}</small> : null}
                              </td>
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
      {printingApu ? <ApuPrintModal apu={printingApu} onClose={() => setPrintingApu(null)} /> : null}
    </main>
  );
}
