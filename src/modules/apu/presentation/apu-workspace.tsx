"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
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
  getSupabaseBrowser,
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
import { exportApuToXlsx } from "./apu-xlsx-export";
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

type MeasurementUnit = { name: string; symbol: string; aliases?: string[] };

const measurementUnits: MeasurementUnit[] = [
  { name: "Unidad", symbol: "und", aliases: ["unidad", "un", "ud"] },
  { name: "Global", symbol: "glb", aliases: ["global", "suma global"] },
  { name: "Kilogramo", symbol: "kg", aliases: ["kilo", "kilogramos"] },
  { name: "Gramo", symbol: "g", aliases: ["gramo", "gramos"] },
  { name: "Tonelada", symbol: "t", aliases: ["tonelada", "toneladas"] },
  { name: "Libra", symbol: "lb", aliases: ["libra", "libras"] },
  { name: "Onza", symbol: "oz", aliases: ["onza", "onzas"] },
  { name: "Metro", symbol: "m", aliases: ["metro", "metros"] },
  { name: "Metro lineal", symbol: "ml", aliases: ["metro lineal", "metros lineales"] },
  { name: "Centímetro", symbol: "cm", aliases: ["centimetro", "centímetros"] },
  { name: "Milímetro", symbol: "mm", aliases: ["milimetro", "milímetros"] },
  { name: "Kilómetro", symbol: "km", aliases: ["kilometro", "kilómetros"] },
  { name: "Pulgada", symbol: "in", aliases: ["pulgada", "pulgadas"] },
  { name: "Pie", symbol: "ft", aliases: ["pie", "pies"] },
  { name: "Yarda", symbol: "yd", aliases: ["yarda", "yardas"] },
  { name: "Milla", symbol: "mi", aliases: ["milla", "millas"] },
  { name: "Metro cuadrado", symbol: "m²", aliases: ["metro cuadrado", "metros cuadrados", "m2"] },
  { name: "Centímetro cuadrado", symbol: "cm²", aliases: ["centimetro cuadrado", "centímetros cuadrados", "cm2"] },
  { name: "Pie cuadrado", symbol: "ft²", aliases: ["pie cuadrado", "pies cuadrados", "ft2"] },
  { name: "Yarda cuadrada", symbol: "yd²", aliases: ["yarda cuadrada", "yardas cuadradas", "yd2"] },
  { name: "Hectárea", symbol: "ha", aliases: ["hectarea", "hectáreas"] },
  { name: "Acre", symbol: "ac", aliases: ["acres"] },
  { name: "Metro cúbico", symbol: "m³", aliases: ["metro cubico", "metros cúbicos", "m3"] },
  { name: "Centímetro cúbico", symbol: "cm³", aliases: ["centimetro cubico", "centímetros cúbicos", "cm3"] },
  { name: "Pie cúbico", symbol: "ft³", aliases: ["pie cubico", "pies cúbicos", "ft3"] },
  { name: "Yarda cúbica", symbol: "yd³", aliases: ["yarda cubica", "yardas cúbicas", "yd3"] },
  { name: "Litro", symbol: "L", aliases: ["litro", "litros"] },
  { name: "Mililitro", symbol: "mL", aliases: ["mililitro", "mililitros"] },
  { name: "Galón", symbol: "gal", aliases: ["galon", "galones"] },
  { name: "Barril", symbol: "bbl", aliases: ["barril", "barriles"] },
  { name: "Metro cúbico por hora", symbol: "m³/h", aliases: ["caudal", "metros cubicos por hora"] },
  { name: "Litro por segundo", symbol: "L/s", aliases: ["litros por segundo", "caudal"] },
  { name: "Hora", symbol: "h", aliases: ["hora", "horas", "hora hombre", "hora maquina"] },
  { name: "Hora hombre", symbol: "HH", aliases: ["hora hombre", "horas hombre"] },
  { name: "Hora máquina", symbol: "HM", aliases: ["hora maquina", "horas maquina"] },
  { name: "Día", symbol: "día", aliases: ["dia", "dias", "día", "días"] },
  { name: "Semana", symbol: "sem", aliases: ["semana", "semanas"] },
  { name: "Mes", symbol: "mes", aliases: ["meses"] },
  { name: "Jornada", symbol: "jor", aliases: ["jornada", "jornadas"] },
  { name: "Viaje", symbol: "viaje", aliases: ["viajes"] },
  { name: "Servicio", symbol: "serv", aliases: ["servicio", "servicios"] },
  { name: "Punto", symbol: "pto", aliases: ["punto", "puntos"] },
  { name: "Paquete", symbol: "paq", aliases: ["paquete", "paquetes"] },
  { name: "Caja", symbol: "caja", aliases: ["cajas"] },
  { name: "Caja por 100", symbol: "cj/100", aliases: ["caja cien", "caja x 100"] },
  { name: "Bulto", symbol: "bulto", aliases: ["bultos"] },
  { name: "Bolsa", symbol: "bolsa", aliases: ["bolsas"] },
  { name: "Saco", symbol: "saco", aliases: ["sacos"] },
  { name: "Caneca", symbol: "caneca", aliases: ["canecas"] },
  { name: "Tambor", symbol: "tambor", aliases: ["tambores"] },
  { name: "Cartucho", symbol: "cart", aliases: ["cartucho", "cartuchos"] },
  { name: "Frasco", symbol: "frasco", aliases: ["frascos"] },
  { name: "Botella", symbol: "botella", aliases: ["botellas"] },
  { name: "Rollo", symbol: "rollo", aliases: ["rollos"] },
  { name: "Carrete", symbol: "carrete", aliases: ["carretes"] },
  { name: "Juego", symbol: "jgo", aliases: ["juego", "juegos"] },
  { name: "Par", symbol: "par", aliases: ["pares"] },
  { name: "Docena", symbol: "doc", aliases: ["docena", "docenas"] },
  { name: "Centena", symbol: "cent", aliases: ["centena", "centenas", "ciento"] },
  { name: "Millar", symbol: "mil", aliases: ["millar", "millares"] },
  { name: "Kit", symbol: "kit", aliases: ["kits"] },
  { name: "Placa", symbol: "placa", aliases: ["placas"] },
  { name: "Varilla", symbol: "var", aliases: ["varilla", "varillas"] },
  { name: "Tramo", symbol: "tramo", aliases: ["tramos"] },
  { name: "Pulgada de diámetro", symbol: "in-dia", aliases: ["pulgada diametro", "diametro"] },
  { name: "Amperio", symbol: "A", aliases: ["amperio", "amperios"] },
  { name: "Voltio", symbol: "V", aliases: ["voltio", "voltios"] },
  { name: "Kilovatio", symbol: "kW", aliases: ["kilovatio", "kilovatios"] },
  { name: "Kilovoltamperio", symbol: "kVA", aliases: ["kilovoltamperio", "kilovoltamperios"] },
  { name: "Kilovatio hora", symbol: "kWh", aliases: ["kilovatio hora", "kilovatios hora"] },
  { name: "Ohmio", symbol: "Ω", aliases: ["ohmio", "ohmios", "ohm"] },
  { name: "Pascal", symbol: "Pa", aliases: ["pascal", "pascales"] },
  { name: "Libra por pulgada cuadrada", symbol: "psi", aliases: ["psi", "presion"] },
  { name: "Grado Celsius", symbol: "°C", aliases: ["celsius", "grado", "temperatura"] },
];

const normalizeSearchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CO");

function ApuUnitCombobox({ value, onChange, name, className = "" }: { value: string; onChange: (unit: string) => void; name?: string; className?: string }) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = normalizeSearchText(query.trim());
  const results = measurementUnits.filter((unit) => {
    const searchable = [unit.name, unit.symbol, ...(unit.aliases ?? [])].join(" ");
    return !normalizedQuery || normalizeSearchText(searchable).includes(normalizedQuery);
  });

  function selectUnit(unit: MeasurementUnit) {
    onChange(unit.symbol);
    setQuery(unit.symbol);
    setIsOpen(false);
  }

  return (
    <div className={`apu-unit-combobox ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <input
        value={query}
        role="combobox"
        aria-label="Unidad de medida"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={isOpen}
        placeholder="Unidad"
        onFocus={(event) => { setIsOpen(true); event.currentTarget.select(); }}
        onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
        onBlur={() => window.setTimeout(() => { setIsOpen(false); setQuery(value); }, 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setIsOpen(false); setQuery(value); }
          if (event.key === "Enter" && isOpen && results.length) { event.preventDefault(); selectUnit(results[0]); }
        }}
      />
      {isOpen ? (
        <div id={listId} className="apu-unit-options" role="listbox" aria-label="Unidades de medida disponibles">
          {results.length ? results.map((unit) => (
            <button type="button" role="option" aria-selected={value === unit.symbol} key={unit.symbol} onMouseDown={(event) => event.preventDefault()} onClick={() => selectUnit(unit)}>
              <span>{unit.name}</span><strong>{unit.symbol}</strong>
            </button>
          )) : <p>No hay una unidad que coincida.</p>}
        </div>
      ) : null}
    </div>
  );
}

type QuoteContext = { quoteId?: string; quoteCode?: string; quoteTitle?: string; quoteStatus?: string };

export function ApuWorkspace({ quoteContext }: { quoteContext?: QuoteContext }) {
  const isQuoteApuReadOnly = Boolean(quoteContext?.quoteId && !["estimating", "revision_requested"].includes(quoteContext.quoteStatus ?? "estimating"));
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<{
    count: number;
    error?: string;
    loading: boolean;
  }>({ count: 0, loading: true });
  const [isSendingRequisition, setIsSendingRequisition] = useState(false);
  const [requisitionCode, setRequisitionCode] = useState("");
  const [isExporting, setIsExporting] = useState(false);
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
  const [newApuUnit, setNewApuUnit] = useState("m²");
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
    setNewApuUnit("m²");
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

  /** Faltantes de este APU: lo que el análisis necesita y el inventario no tiene. */
  const shortages = useMemo(() => {
    if (!selected) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return selected.lines
      .filter((line) => line.category === "materials" || line.category === "equipment")
      .filter((line) => Boolean(line.inventoryProductId))
      .map((line) => {
        const product = byId.get(line.inventoryProductId!);
        if (!product) return null;
        const required = Number(line.quantity) || 0;
        const available = Number(product.available ?? 0);
        const missing = Math.max(0, required - available);
        return { line, product, required, available, missing };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .filter((row) => row.missing > 0);
  }, [selected, products]);

  /** Envía los faltantes del APU al almacén como requisición de la obra vinculada. */
  async function generateRequisitionFromApu() {
    if (!selected || !companyId || !projectToLink) {
      setSaveState("error");
      setSaveMessage("Guarda el APU y selecciona la obra destino antes de generar la requisición.");
      return;
    }
    if (isQuoteApuReadOnly) {
      setSaveState("error");
      setSaveMessage("El APU está en consulta; la requisición se genera desde la ficha de la obra.");
      return;
    }
    if (!shortages.length) {
      setSaveState("database");
      setSaveMessage("No hay faltantes: el inventario cubre lo que este APU necesita.");
      return;
    }
    setIsSendingRequisition(true);
    const db = await getSupabaseBrowser();
    if (!db) {
      setIsSendingRequisition(false);
      setSaveState("error");
      setSaveMessage("No fue posible conectar con la base de datos.");
      return;
    }
    const { data, error } = await db.rpc("create_inventory_requisition", {
      target_project: projectToLink,
      requester_name: selected.name,
      target_needed_by: null,
      request_notes: `Generada desde el APU ${selected.code} · ${selected.name}.`,
      request_lines: shortages.map((row) => ({
        stock_id: row.product.id,
        quantity: row.missing,
        notes: `Requerido ${row.required}, en inventario ${row.available}.`,
      })),
    });
    setIsSendingRequisition(false);
    if (error) {
      setSaveState("error");
      setSaveMessage(`No fue posible crear la requisición: ${error.message}`);
      return;
    }
    const created = Array.isArray(data) ? data[0] : data;
    setRequisitionCode(created?.requisition_code ?? created?.code ?? "");
    setSaveState("database");
    setSaveMessage(
      `Requisición ${created?.requisition_code ?? created?.code ?? ""} enviada al almacén con ${shortages.length} línea(s) faltante(s).`,
    );
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
            <div><ApuUnitCombobox name="unit" value={newApuUnit} onChange={setNewApuUnit} /><input name="quantity" type="number" min="0.01" step="any" defaultValue="1" aria-label="Cantidad de obra" /></div>
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
                <label><span>Unidad</span><ApuUnitCombobox value={selected.unit} onChange={(unit) => updateApu({ ...selected, unit })} /></label>
                <label><span>Cantidad de obra</span><input type="number" min="0.01" step="any" value={selected.workQuantity} onChange={(event) => updateApu({ ...selected, workQuantity: Number(event.target.value) || 1 })} /></label>
              </div>
              <div className="apu-actions-bar" role="group" aria-label="Acciones del APU seleccionado">
                <button type="button" className="inventory-action apu-action-primary" onClick={() => void saveSelectedApu()} title="Guarda esta actividad en Supabase">
                  💾 Guardar APU
                </button>
                <button type="button" className="apu-print-btn apu-action-secondary" onClick={() => setPrintingApu(selected)} title="Abre el formato imprimible de esta actividad">
                  🖨️ Imprimir APU
                </button>
                <button
                  type="button"
                  className="apu-print-btn apu-action-secondary"
                  onClick={() => void exportApuToXlsx(selected)}
                  disabled={isExporting}
                  title="Descarga el APU en Excel conservando columnas, estilos e impresión"
                >
                  {isExporting ? "⏳ Generando…" : "📊 Exportar XLSX"}
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

              {/* Faltantes del APU → requisición al almacén (APU-012) */}
              <section className="apu-shortage-panel" aria-label="Faltantes de materiales y equipos">
                <div className="apu-analysis-header">
                  <div>
                    <p>Faltantes para ejecutar este APU</p>
                    <small>
                      {shortages.length === 0
                        ? "El inventario cubre todo lo que este análisis necesita."
                        : `${shortages.length} recurso(s) deben comprarse o ingresar al almacén antes de iniciar la obra.`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="inventory-action"
                    onClick={() => void generateRequisitionFromApu()}
                    disabled={isSendingRequisition || !projectToLink || isQuoteApuReadOnly}
                    title={projectToLink ? "Envía los faltantes al almacén de la obra seleccionada" : "Selecciona primero la obra destino"}
                  >
                    {isSendingRequisition ? "⏳ Enviando…" : "📦 Generar requisición"}
                  </button>
                </div>
                {shortages.length > 0 ? (
                  <div className="apu-table-wrap">
                    <table className="apu-section table">
                      <thead>
                        <tr>
                          <th>Recurso</th>
                          <th>Requerido</th>
                          <th>En inventario</th>
                          <th>Falta comprar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shortages.map((row) => (
                          <tr key={row.line.id}>
                            <td>{row.product.name}</td>
                            <td>{row.required.toLocaleString("es-CO")} {row.product.unit}</td>
                            <td>{row.available.toLocaleString("es-CO")} {row.product.unit}</td>
                            <td><strong>{row.missing.toLocaleString("es-CO")} {row.product.unit}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {requisitionCode ? (
                  <p className="apu-notice-inline">✓ Requisición {requisitionCode} enviada al almacén.</p>
                ) : null}
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
