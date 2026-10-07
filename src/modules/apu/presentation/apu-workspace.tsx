"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { ApuImportModal } from "./apu-import-modal";
import { ApuNewModal } from "./apu-new-modal";
import { ApuManualResourceModal, type ManualResource } from "./apu-manual-resource-modal";
import { ApuMoneyField } from "./apu-money-field";
import { ApuQuantityField } from "./apu-quantity-field";
import { formatApuQuantity, parseApuQuantityInput, safeApuQuantity } from "./apu-quantity";
import { ApuUnitCombobox } from "./apu-unit-combobox";
import { exportApusToXlsx } from "./apu-xlsx-export";
import { ApuResourcePicker } from "./apu-resource-picker";
import { ApuTransportPicker } from "./apu-transport-picker";

const categories: ApuCategory[] = ["equipment", "materials", "labor", "transport"];
const emptyLaborCatalog: LaborPositionCatalog = { positions: [], source: "fallback" };
const formatCOP = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const newId = () => crypto.randomUUID();

/** Preferencia de interfaz (no autoritativa): qué rubros del APU están plegados. */
const COLLAPSED_KEY = "rfc_apu_rubros_plegados";

const readCollapsed = (): ApuCategory[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is ApuCategory => categories.includes(value as ApuCategory));
  } catch {
    return [];
  }
};

const writeCollapsed = (value: ApuCategory[]) => {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(value));
  } catch {
    // Si el navegador bloquea el almacenamiento, la preferencia simplemente no persiste.
  }
};
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

type QuoteContext = { quoteId?: string; quoteCode?: string; quoteTitle?: string; quoteStatus?: string };
type QuoteOption = { id: string; code: string; title: string; client: string; status: string };

/** Al entrar directo se muestran solo APUs generales; los de una cotización
 * se ven únicamente al abrir su contexto desde Cotizaciones o el buscador. */
const filterApusByQuoteContext = (items: Apu[], quoteId?: string) =>
  quoteId
    ? items.filter((apu) => apu.quoteId === quoteId)
    : items.filter((apu) => !apu.quoteId);

export function ApuWorkspace({ quoteContext }: { quoteContext?: QuoteContext }) {
  const router = useRouter();
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
  /** Datos de la cotización de origen, para buscar y ubicar cada actividad. */
  const [quoteOrigin, setQuoteOrigin] = useState<Map<string, { code: string; title: string; client: string; status: string }>>(new Map());
  const [quoteSearch, setQuoteSearch] = useState("");
  const [search, setSearch] = useState("");
  /** Rubros plegados. Solo es una preferencia visual, no afecta los datos guardados. */
  const [collapsed, setCollapsed] = useState<ApuCategory[]>([]);
  const [isShortageCollapsed, setIsShortageCollapsed] = useState(false);
  const [isCollapsedReady, setIsCollapsedReady] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setIsCollapsedReady(true);
  }, []);

  function toggleSection(category: ApuCategory) {
    setCollapsed((current) => {
      const next = current.includes(category) ? current.filter((value) => value !== category) : [...current, category];
      writeCollapsed(next);
      return next;
    });
  }

  /** @param collapseAll true = plegar todos, false = expandir todos. */
  function setAllSections(collapseAll: boolean) {
    const next = collapseAll ? [...categories] : [];
    setCollapsed(next);
    writeCollapsed(next);
  }

  function toggleShortagePanel() {
    setIsShortageCollapsed((current) => !current);
  }
  async function exportVisibleApus() {
    if (!visibleApus.length) return;
    setIsExporting(true);
    try {
      const fileLabel = quoteContext?.quoteCode ? `APU-${quoteContext.quoteCode}` : "APU-RFC";
      await exportApusToXlsx(visibleApus, fileLabel);
      setSaveState("idle");
      setSaveMessage(`${visibleApus.length} actividad(es) exportada(s) en un libro RFC, una hoja por actividad.`);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "No fue posible generar el archivo XLSX.");
    } finally {
      setIsExporting(false);
    }
  }
  const [projectToLink, setProjectToLink] = useState("");
  const [costType, setCostType] = useState<ProjectBoqCost["costType"]>("committed");
  const [costAmount, setCostAmount] = useState("");
  const [costReference, setCostReference] = useState("");
  const [printingApu, setPrintingApu] = useState<Apu | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  /** Recurso que se está ingresando a mano, con el texto que ya se había buscado. */
  const [manualResource, setManualResource] = useState<{ category: ApuCategory; query: string } | null>(null);
  /** Se incrementa al aceptar un alta manual para limpiar el buscador del rubro. */
  const [clearSearchSignal, setClearSearchSignal] = useState(0);
  const selected = useMemo(() => apus.find((apu) => apu.id === selectedId), [apus, selectedId]);
  const visibleApus = useMemo(
    () => filterApusByQuoteContext(apus, quoteContext?.quoteId),
    [apus, quoteContext?.quoteId],
  );
  const quoteOptions = useMemo<QuoteOption[]>(
    () => Array.from(quoteOrigin, ([id, quote]) => ({ id, ...quote })).sort((a, b) => a.code.localeCompare(b.code, "es-CO")),
    [quoteOrigin],
  );
  const matchingQuotes = useMemo(() => {
    const search = quoteSearch.trim().toLocaleLowerCase("es-CO");
    if (!search) return [];
    return quoteOptions
      .filter((quote) => [quote.code, quote.title, quote.client].some((value) => value.toLocaleLowerCase("es-CO").includes(search)))
      .slice(0, 6);
  }, [quoteOptions, quoteSearch]);

  function openQuoteApu(quote: QuoteOption) {
    const params = new URLSearchParams({
      quoteId: quote.id,
      quoteCode: quote.code,
      quoteTitle: quote.title,
      quoteStatus: quote.status,
    });
    router.push(`/apu?${params.toString()}`);
  }
  /**
   * Filtro de búsqueda del módulo: código del APU, nombre de la actividad,
   * código o título de la cotización y empresa que contrata.
   */
  const filteredApus = useMemo(() => {
    const term = search.trim().toLowerCase();
    const collapse = (value: string | undefined) =>
      (value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const needle = collapse(term);
    if (!needle) return visibleApus;
    return visibleApus.filter((apu) => {
      const origin = apu.quoteId ? quoteOrigin.get(apu.quoteId) : undefined;
      const haystack = collapse(
        [apu.code, apu.name, apu.unit, apu.quoteCode, origin?.code, origin?.title, origin?.client]
          .filter(Boolean)
          .join(" "),
      );
      return needle.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [visibleApus, search, quoteOrigin]);

  /** Costo por unidad de la actividad: costo directo total ÷ cantidad de la obra. */
  const selectedCost = selected ? apuCostTotal(selected) : 0;
  /** Actividades creadas pero todavía sin recursos: no aportan al total. */
  const pendingCount = visibleApus.filter((apu) => apu.lines.length === 0).length;
  const selectedQuantity = selected ? safeApuQuantity(selected.workQuantity) : 0;
  const unitCost = selectedQuantity > 0 ? selectedCost / selectedQuantity : 0;
  const unitSelling = selectedQuantity > 0 && selected ? apuSellingTotal(selected) / selectedQuantity : 0;
  const hasRealQuantity = selectedQuantity > 1;

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
          setQuoteOrigin(remote.quoteOrigin ?? new Map());
          setApus(remote.apus);
          const visible = filterApusByQuoteContext(remote.apus, quoteContext?.quoteId);
          setSelectedId(visible[0]?.id || "");
          setSaveMessage("APUs cargados desde la base de datos.");
          return;
        }
        // Modo offline / sin Supabase
        if (!active) return;
        setProjects(mergeProjects(loadFallbackProjects(), seedFallback));
        const saved = JSON.parse(localStorage.getItem("rfc_apus") || "[]") as Apu[];
        setApus(saved);
        const visible = filterApusByQuoteContext(saved, quoteContext?.quoteId);
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

  /** Consecutivo siguiente del APU, visible en el modal antes de crear. */
  const nextApuCode = `APU-${String(apus.length + 1).padStart(3, "0")}`;

  function createApu(values: { name: string; unit: string; workQuantity: number }) {
    if (isQuoteApuReadOnly) { setSaveState("error"); setSaveMessage("Este APU se conserva en consulta porque la cotización ya no está en proceso o por modificar."); return; }
    const now = new Date().toISOString();
    const apu: Apu = {
      id: newId(),
      code: nextApuCode,
      name: values.name,
      unit: values.unit,
      workQuantity: values.workQuantity,
      lines: [],
      quoteId: quoteContext?.quoteId,
      quoteCode: quoteContext?.quoteCode,
      createdAt: now,
      updatedAt: now,
    };
    setApus((current) => [apu, ...current]);
    setSelectedId(apu.id);
    setIsNewModalOpen(false);
    setSaveState("saving");
    setSaveMessage(`${apu.code} creado. Agrega los recursos de cada rubro y pulsa Guardar APU.`);
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

  /** Crea una actividad a partir de la vista previa de un archivo de Excel. */
  function createApuFromImport(draft: {
    code: string;
    name: string;
    unit: string;
    workQuantity: number;
    lines: ApuLine[];
    importedCount: number;
  }) {
    const now = new Date().toISOString();
    const generated = `APU-${String(apus.length + 1).padStart(3, "0")}`;
    const apu: Apu = {
      id: newId(),
      // El código del archivo solo se respeta si no está repetido en el sistema.
      code: draft.code && !apus.some((item) => item.code === draft.code) ? draft.code : generated,
      name: draft.name || "Actividad importada",
      unit: draft.unit || "und",
      workQuantity: draft.workQuantity > 0 ? draft.workQuantity : 1,
      lines: draft.lines,
      quoteId: quoteContext?.quoteId,
      quoteCode: quoteContext?.quoteCode,
      createdAt: now,
      updatedAt: now,
    };
    setApus((current) => [apu, ...current]);
    setSelectedId(apu.id);
    setIsImportOpen(false);
    setSaveState("saving");
    setSaveMessage(`Importadas ${draft.importedCount} líneas desde Excel. Revísalas y pulsa Guardar APU para confirmarlas en la base de datos.`);
  }

  function updateApu(apu: Apu) {
    if (isQuoteApuReadOnly) { setSaveState("error"); setSaveMessage("El APU está bloqueado para edición en el estado actual de la cotización."); return; }
    setApus((current) => current.map((item) => item.id === apu.id ? { ...apu, updatedAt: new Date().toISOString() } : item));
    setSaveMessage("Hay cambios pendientes de guardar.");
  }

  /** Abre el alta manual del rubro, propone como nombre lo que se había buscado. */
  function openManualResource(category: ApuCategory, query: string) {
    if (!selected) return;
    if (isQuoteApuReadOnly) {
      setSaveState("error");
      setSaveMessage("Este APU está en consulta; crea una revisión de la cotización para editarlo.");
      return;
    }
    setManualResource({ category, query });
  }

  /** Confirma el alta manual: agrega la línea completa y deja el buscador en blanco. */
  function acceptManualResource(values: ManualResource) {
    if (!selected || !manualResource) return;
    const rate = parseApuQuantityInput(values.dailyRate);
    const line: ApuLine = {
      id: newId(),
      category: manualResource.category,
      name: values.name,
      quantity: safeApuQuantity(values.quantity) || 1,
      yieldPerDay: manualResource.category === "materials" ? 1 : safeApuQuantity(values.yieldPerDay) || 1,
      dailyRate: safeApuQuantity(rate),
      unit: values.unit || undefined,
    };
    setApus((current) =>
      current.map((item) => (item.id === selected.id ? { ...item, lines: [...item.lines, line], updatedAt: new Date().toISOString() } : item)),
    );
    setManualResource(null);
    setClearSearchSignal((value) => value + 1);
    setSaveState("saving");
    setSaveMessage(`${values.name} se agregó a ${apuCategoryMeta[manualResource.category].label.toLocaleLowerCase("es-CO")}. Pulsa Guardar APU para confirmarlo.`);
  }

  function addLine(category: ApuCategory, product?: StockProduct) {
    if (!selected) return;
    if (!product) {
      openManualResource(category, "");
      return;
    }
    const line: ApuLine = {
      id: newId(),
      category,
      name: product.name,
      quantity: 1,
      yieldPerDay: 1,
      dailyRate: product.unitCost || 0,
      inventoryProductId: product.id,
      unit: product.unit,
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
    const nextVisible = filterApusByQuoteContext(nextApus, quoteContext?.quoteId);
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
      {!quoteContext?.quoteId ? (
        <section className="apu-quote-picker" aria-labelledby="apu-quote-picker-title">
          <div>
            <p id="apu-quote-picker-title">Abrir APU de una cotización</p>
            <small>Busca por código, cliente o nombre para trabajar únicamente sus actividades.</small>
          </div>
          <label className="apu-quote-picker-search">
            <span>Buscar cotización</span>
            <input
              value={quoteSearch}
              onChange={(event) => setQuoteSearch(event.target.value)}
              placeholder="Ej.: COT-001, Ocensa o prefabricado"
              type="search"
              autoComplete="off"
              aria-describedby="apu-quote-picker-help"
            />
          </label>
          <div id="apu-quote-picker-help" className="apu-quote-picker-results" aria-live="polite">
            {quoteSearch.trim() ? (
              matchingQuotes.length ? matchingQuotes.map((quote) => (
                <button key={quote.id} type="button" onClick={() => openQuoteApu(quote)}>
                  <strong>{quote.code}</strong>
                  <span>{quote.title}</span>
                  <small>{quote.client}</small>
                </button>
              )) : <p>No encontramos una cotización con esos datos. Prueba con el código, cliente o nombre.</p>
            ) : <p>Escribe para buscar entre las cotizaciones de tu empresa.</p>}
          </div>
        </section>
      ) : null}
      {quoteContext?.quoteCode ? (
        <p className={`apu-quote-context ${isQuoteApuReadOnly ? "is-read-only" : ""}`}>{isQuoteApuReadOnly ? <>Estás consultando el APU de <strong>{quoteContext.quoteCode}</strong>. Se conserva como historial de la oferta; para modificarlo, crea una revisión de cotización.</> : <>Estás creando actividades para la cotización <strong>{quoteContext.quoteCode}</strong>. Guarda cada APU antes de volver a Cotizaciones.</>}</p>
      ) : null}
      {/* Resumen del presupuesto: suma de TODAS las actividades. Va arriba del módulo,
          no dentro de la ficha de una actividad. */}
      {visibleApus.length > 0 ? (
        <section className="apu-summary-bar" aria-label="Resumen del presupuesto">
          <div className="apu-summary-title">
            <p>Resumen del presupuesto</p>
            <small>
              Suma de las {analysisTotals.count} actividades
              {pendingCount > 0 ? ` · ${pendingCount} sin cotizar` : ""}
            </small>
          </div>
          <dl className="apu-summary-figures">
            <div>
              <dt>Costo directo</dt>
              <dd>{formatCOP(analysisTotals.cost)}</dd>
            </div>
            <div>
              <dt>Ganancia</dt>
              <dd>+{formatCOP(analysisTotals.profit)}</dd>
            </div>
            <div className="is-total">
              <dt>Precio de venta total</dt>
              <dd>{formatCOP(analysisTotals.selling)}</dd>
            </div>
          </dl>
        </section>
      ) : null}
      <ApuActivityCatalog onCreate={createApuFromActivity} />
      <section className="apu-layout">
        <aside className="dashboard-panel apu-list">
          {/* Las acciones van arriba: con muchas actividades el final de la lista queda fuera de vista. */}
          <div className="apu-list-actions">
            <button
              type="button"
              className="inventory-action apu-list-new"
              onClick={() => setIsNewModalOpen(true)}
              disabled={isQuoteApuReadOnly}
              title={
                isQuoteApuReadOnly
                  ? "La cotización está en consulta; crea una revisión para agregar actividades"
                  : "Crear una actividad nueva"
              }
            >
              ➕ Nuevo APU
            </button>
            <button
              type="button"
              className="inventory-action secondary apu-import-launch"
              onClick={() => setIsImportOpen(true)}
              title="Cargar un APU desde un archivo de Excel con el formato de RFC"
            >
              📥 Importar desde Excel
            </button>
          </div>
          <div className="panel-title"><div><p>APUs</p><h2>{visibleApus.length} análisis</h2></div></div>
          <label className="apu-search">
            <span className="sr-only">Buscar análisis de precios unitarios</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, actividad o empresa…"
              aria-label="Buscar por código, nombre de la actividad o empresa que contrata"
              aria-describedby="apu-search-count"
              title="Busca por código del APU, nombre de la actividad, código o cliente de la cotización"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar la búsqueda de análisis"
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            ) : null}
          </label>
          <small id="apu-search-count" className="apu-search-count" aria-live="polite">
            {search.trim()
              ? `${filteredApus.length} de ${visibleApus.length} coinciden`
              : "Busca por código, actividad o empresa que contrata."}
          </small>
          <div className="apu-analysis-total" aria-label="Total del análisis">
            <span>Total de las {analysisTotals.count} actividades</span>
            <strong>{formatCOP(analysisTotals.selling)}</strong>
            <small>
              Costo {formatCOP(analysisTotals.cost)} · Ganancia +{formatCOP(analysisTotals.profit)}
            </small>
          </div>
          {filteredApus.length === 0 && visibleApus.length > 0 ? (
            <p className="apu-search-empty">
              Ninguna actividad coincide con “{search}”. Puedes buscarla por código (APU-001), por nombre de la
              actividad o por la empresa que contrata.
            </p>
          ) : null}
          {filteredApus.map((apu) => {
            const origin = apu.quoteId ? quoteOrigin.get(apu.quoteId) : undefined;
            const isEmpty = apu.lines.length === 0;
            return (
              <button
                type="button"
                key={apu.id}
                className={`apu-row ${apu.id === selectedId ? "is-selected" : ""} ${isEmpty ? "is-empty" : ""}`}
                onClick={() => setSelectedId(apu.id)}
                title={`${apu.code} · ${apu.name}${origin?.client ? ` · ${origin.client}` : ""}`}
              >
                <strong>{apu.code}</strong>
                <span>{apu.name}</span>
                {isEmpty ? (
                  <small className="apu-row-empty">Sin recursos · aún no está cotizada</small>
                ) : null}
                {origin?.client || apu.quoteCode ? (
                  <small className="apu-row-origin">
                    {origin?.client ? origin.client : origin?.title}
                    {apu.quoteCode ? ` · ${apu.quoteCode}` : ""}
                  </small>
                ) : null}
                <small>Venta: {formatCOP(apuSellingTotal(apu))}</small>
              </button>
            );
          })}
        </aside>
        <section className="dashboard-panel apu-editor">
          {selected ? (
            <>
              <div className="panel-title apu-editor-heading">
                <div>
                  <p>{selected.code} · {selected.unit}</p>
                  <h2>{selected.name}</h2>
                  <small>Cantidad de obra: {formatApuQuantity(selected.workQuantity)} {selected.unit}</small>
                  <small className="apu-price-share">
                    {analysisTotals.selectedShare.toFixed(1)}% del total del presupuesto
                  </small>
                </div>
                {/* Precio y costo de la actividad, uno junto al otro. */}
                <div className="apu-price-block">
                  <div className="apu-price-cell is-selling">
                    <span>Precio de venta</span>
                    <strong>{formatCOP(apuSellingTotal(selected))}</strong>
                    <small>
                      {formatCOP(unitSelling)} <em>por {selected.unit}</em>
                    </small>
                  </div>
                  <div className="apu-price-cell is-cost">
                    <span>Costo por {selected.unit}</span>
                    <strong>{formatCOP(unitCost)}</strong>
                    <small>
                      {formatCOP(selectedCost)} <em>÷ {formatApuQuantity(selected.workQuantity)} {selected.unit}</em>
                    </small>
                  </div>
                </div>
              </div>
              {!hasRealQuantity ? (
                <p className="apu-unitcost-warning" role="status">
                  La cantidad de la actividad está en 1, así que el costo por unidad coincide con el total.
                  Escribe la cantidad real de la obra para que el costo por unidad sea correcto.
                </p>
              ) : null}
              <div className="apu-selected-toolbar">
                <label><span>Actividad</span><input value={selected.name} onChange={(event) => updateApu({ ...selected, name: event.target.value })} /></label>
                <label><span>Unidad</span><ApuUnitCombobox value={selected.unit} onChange={(unit) => updateApu({ ...selected, unit })} /></label>
                <label>
                  <span>Cantidad de obra</span>
                  <ApuQuantityField
                    value={selected.workQuantity}
                    onCommit={(next) => updateApu({ ...selected, workQuantity: next > 0 ? next : 1 })}
                    ariaLabel="Cantidad de obra de la actividad"
                    title="Cantidad de obra: es el divisor del costo por unidad"
                  />
                </label>
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
                  onClick={() => void exportVisibleApus()}
                  disabled={isExporting}
                  title="Descarga todas las actividades del contexto actual en un libro RFC, una hoja por actividad"
                >
                  {isExporting ? "⏳ Generando…" : `📊 Exportar ${visibleApus.length} APU(s)`}
                </button>
                <button
                  type="button"
                  className="apu-print-btn apu-action-secondary"
                  onClick={() => setIsImportOpen(true)}
                  title="Cargar un APU desde un archivo de Excel con el formato de RFC"
                >
                  📥 Importar XLSX
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
                    <small>{formatCOP(selectedQuantity > 0 ? apuCostTotal(selected) / selectedQuantity : 0)} / {selected.unit}</small>
                  </div>
                  <div className="apu-financial-card">
                    <p>Ganancia Estimada</p>
                    <strong>+{formatCOP(apuProfitAmount(selected))}</strong>
                    <small>+{apuEffectiveMarginPercent(selected).toFixed(1)}% margen global</small>
                  </div>
                  <div className="apu-financial-card is-selling">
                    <p>Precio Venta Cotizado</p>
                    <strong>{formatCOP(apuSellingTotal(selected))}</strong>
                    <small>{formatCOP(selectedQuantity > 0 ? apuSellingTotal(selected) / selectedQuantity : 0)} / {selected.unit} (unitario)</small>
                  </div>
                </div>
              </section>

              {/* El resumen del presupuesto vive arriba, a nivel de módulo: es la suma de todas
                  las actividades, no de la que se está editando. */}


              <section className="apu-budget-control" aria-label="Presupuesto de obra">
                <div><p>Presupuesto BOQ y control de obra</p><h3>Vincular este APU al presupuesto</h3><small>{companyId ? "Guarda una versión y selecciónala como línea presupuestal de una obra." : "Modo local: selecciona una obra para vincular este APU."}</small></div>
                <div className="apu-budget-link"><select value={projectToLink} onChange={(event) => setProjectToLink(event.target.value)} aria-label="Obra destino"><option value="">Seleccione obra activa…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select><button type="button" onClick={() => void sendSelectedToBoq()} disabled={(!selected.versionId && !!companyId) || !projectToLink}>Enviar a presupuesto</button></div>
              </section>

              {/* Faltantes del APU → requisición al almacén (APU-012) */}
              <section className={`apu-shortage-panel ${isShortageCollapsed ? "is-collapsed" : ""}`} aria-label="Faltantes de materiales y equipos">
                <div className="apu-section-bar">
                  <button
                    type="button"
                    className="apu-section-toggle"
                    onClick={() => toggleShortagePanel()}
                    aria-expanded={!isShortageCollapsed}
                    aria-controls="apu-shortage-body"
                    title={isShortageCollapsed ? "Expandir los faltantes" : "Plegar los faltantes"}
                  >
                    <span className="apu-section-chevron" aria-hidden="true">{isShortageCollapsed ? "▸" : "▾"}</span>
                    <span className="apu-section-heading">
                      <strong>Faltantes para ejecutar este APU</strong>
                      <small>
                        {shortages.length === 0
                          ? "El inventario cubre todo lo que este análisis necesita."
                          : `${shortages.length} recurso${shortages.length === 1 ? "" : "s"} por comprar antes de iniciar la obra`}
                      </small>
                    </span>
                  </button>
                </div>
                <div id="apu-shortage-body" hidden={isShortageCollapsed}>
                <div className="apu-shortage-actions">
                  <small>
                    {shortages.length === 0
                      ? "No hace falta comprar nada para ejecutar esta actividad."
                      : `${shortages.length} recurso(s) deben comprarse o ingresar al almacén antes de iniciar la obra.`}
                  </small>
                  <button
                    type="button"
                    className="inventory-action"
                    onClick={() => void generateRequisitionFromApu()}
                    disabled={isSendingRequisition || !projectToLink || isQuoteApuReadOnly || shortages.length === 0}
                    title={
                      shortages.length === 0
                        ? "Esta actividad no tiene faltantes"
                        : projectToLink
                        ? "Envía los faltantes al almacén de la obra seleccionada"
                        : "Selecciona primero la obra destino"
                    }
                  >
                    {isSendingRequisition ? "⏳ Enviando…" : "📦 Generar requisición"}
                  </button>
                </div>
                {shortages.length > 0 ? (
                  <div className="apu-table-wrap">
                    <table className="apu-shortage-table">
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
                            <td>{formatApuQuantity(row.required)} {row.product.unit}</td>
                            <td>{formatApuQuantity(row.available)} {row.product.unit}</td>
                            <td><strong>{formatApuQuantity(row.missing)} {row.product.unit}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {requisitionCode ? (
                  <p className="apu-notice-inline">✓ Requisición {requisitionCode} enviada al almacén.</p>
                ) : null}
                </div>
              </section>
              {companyId && boqItems.filter((item) => item.apuAnalysisId === selected.id).map((item) => {
                const committed = boqCosts.filter((cost) => cost.boqItemId === item.id && cost.costType === "committed").reduce((sum, cost) => sum + cost.amount, 0);
                const actual = boqCosts.filter((cost) => cost.boqItemId === item.id && cost.costType === "actual").reduce((sum, cost) => sum + cost.amount, 0);
                return <section className="apu-boq-status" key={item.id}><div><p>Control BOQ · {item.code}</p><h3>{item.description}</h3></div><dl><div><dt>Presupuestado</dt><dd>{formatCOP(item.budgetTotal)}</dd></div><div><dt>Comprometido</dt><dd>{formatCOP(committed)}</dd></div><div><dt>Real</dt><dd>{formatCOP(actual)}</dd></div><div><dt>Variación</dt><dd className={actual > item.budgetTotal ? "is-over" : ""}>{formatCOP(item.budgetTotal - actual)}</dd></div></dl><div className="apu-boq-entry"><select value={costType} onChange={(event) => setCostType(event.target.value as ProjectBoqCost["costType"])}><option value="committed">Comprometido</option><option value="actual">Real ejecutado</option></select><input type="number" min="0" step="any" value={costAmount} onChange={(event) => setCostAmount(event.target.value)} placeholder="Valor COP" aria-label="Valor del costo" /><input value={costReference} onChange={(event) => setCostReference(event.target.value)} placeholder="OC, factura o referencia" aria-label="Referencia del costo" /><button type="button" onClick={() => void addBoqCost(item.id)}>Registrar</button></div></section>;
              })}
              {isCollapsedReady ? (
                <div className="apu-sections-tools" role="group" aria-label="Plegar o expandir los rubros del APU">
                  <button
                    type="button"
                    onClick={() => setAllSections(false)}
                    disabled={collapsed.length === 0}
                    title="Expandir los cuatro rubros y mostrar sus recursos"
                    aria-label="Expandir todos los rubros"
                  >
                    ▾ Expandir todo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllSections(true)}
                    disabled={collapsed.length === categories.length}
                    title="Plegar los cuatro rubros para ver solo el resumen de cada uno"
                    aria-label="Plegar todos los rubros"
                  >
                    ▸ Plegar todo
                  </button>
                </div>
              ) : null}
              {categories.map((category) => {
                const lines = selected.lines.filter((line) => line.category === category);
                const inventoryChoices = category === "materials" || category === "equipment" ? products : [];
                const marginPercent = selected.categoryMargins?.[category] ?? defaultApuMargins[category];
                const costSubtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
                const sellingSubtotal = lines.reduce((sum, line) => sum + lineSellingTotal(line, selected.categoryMargins), 0);
                const isCollapsed = collapsed.includes(category);
                const bodyId = `apu-section-body-${category}`;
                return (
                  <section className={`apu-section ${isCollapsed ? "is-collapsed" : ""}`} key={category}>
                    <div className="apu-section-bar">
                      <button
                        type="button"
                        className="apu-section-toggle"
                        onClick={() => toggleSection(category)}
                        aria-expanded={!isCollapsed}
                        aria-controls={bodyId}
                        title={isCollapsed ? `Expandir ${apuCategoryMeta[category].label}` : `Plegar ${apuCategoryMeta[category].label}`}
                      >
                        <span className="apu-section-chevron" aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
                        <span className="apu-section-heading">
                          <strong>{apuCategoryMeta[category].label}</strong>
                          <small>
                            {lines.length === 0
                              ? "Sin recursos"
                              : `${lines.length} recurso${lines.length === 1 ? "" : "s"} · ${formatCOP(costSubtotal)}`}
                          </small>
                        </span>
                      </button>
                    </div>
                    <div id={bodyId} hidden={isCollapsed}>
                    <header>
                      <div><h3>{apuCategoryMeta[category].label}</h3><small>{apuCategoryMeta[category].description}</small></div>
                      {category === "labor" ? (
                        <ApuLaborPicker catalog={laborCatalog} isLoading={isLaborLoading} onAdd={addLaborPosition} onAddManual={(query) => openManualResource("labor", query)} clearSignal={clearSearchSignal} />
                      ) : category === "materials" || category === "equipment" ? (
                        <ApuResourcePicker
                          category={category}
                          products={inventoryChoices}
                          catalogLoading={catalogStatus.loading}
                          catalogError={catalogStatus.error}
                          onAdd={(product) => addLine(category, product)}
                          onAddManual={(query) => openManualResource(category, query)}
                          clearSignal={clearSearchSignal}
                        />
                      ) : (
                        <ApuTransportPicker
                          catalog={transportCatalog}
                          isLoading={isTransportLoading}
                          onAdd={addTransportItem}
                          onAddManual={(query) => openManualResource("transport", query)}
                          clearSignal={clearSearchSignal}
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
                              <td>
                                <ApuQuantityField
                                  value={line.quantity}
                                  onCommit={(next) => updateLine(line.id, "quantity", next)}
                                  ariaLabel={`Cantidad de ${line.name}`}
                                />
                              </td>
                              <td>
                                <ApuQuantityField
                                  value={line.yieldPerDay}
                                  onCommit={(next) => updateLine(line.id, "yieldPerDay", next)}
                                  ariaLabel={`Rendimiento diario de ${line.name}`}
                                />
                              </td>
                              <td>
                                <ApuMoneyField
                                  value={line.dailyRate}
                                  onCommit={(next) => updateLine(line.id, "dailyRate", next)}
                                  ariaLabel={`Tarifa base de ${line.name}`}
                                />
                              </td>
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
                    </div>
                  </section>
                );
              })}
            </>
          ) : <p className="panel-intro">Crea un APU para empezar a registrar recursos y costos.</p>}
        </section>
      </section>
      {printingApu ? <ApuPrintModal apu={printingApu} onClose={() => setPrintingApu(null)} /> : null}
      {isImportOpen ? <ApuImportModal onClose={() => setIsImportOpen(false)} onConfirm={createApuFromImport} /> : null}
      {isNewModalOpen ? (
        <ApuNewModal
          nextCode={nextApuCode}
          onClose={() => setIsNewModalOpen(false)}
          onCreate={createApu}
        />
      ) : null}
      {manualResource ? (
        <ApuManualResourceModal
          category={manualResource.category}
          initialQuery={manualResource.query}
          onClose={() => setManualResource(null)}
          onAccept={acceptManualResource}
        />
      ) : null}
    </main>
  );
}
