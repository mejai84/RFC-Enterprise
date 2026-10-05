"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import { inventoryUnits, type StockProduct } from "@/modules/inventory";

type Props = { products: StockProduct[] };
type Line = { quantity: string; cost: string; location: string };
type ArticleDraft = {
  name: string;
  sku: string;
  category: string;
  brand: string;
  unit: string;
  reference: string;
  model: string;
  serial: string;
  purchaseUnit: string;
  unitsPerPurchase: string;
  acquiredAt: string;
  warrantyUntil: string;
  notes: string;
};
type SortKey = "location" | "quantity" | "cost" | "status";
type CountScope = "all" | "location" | "category";
type CountSession = {
  id: string;
  reason: string;
  status: string;
  countedAt: string;
  approvedAt?: string | null;
};

const purchasePresentations = [
  "Bolsa",
  "Bulto",
  "Caja",
  "Caneca",
  "Carrete",
  "Galón",
  "Paquete",
  "Par",
  "Rollo",
  "Tambor",
  "Tubo",
  "Unidad",
];
const standardLocations = [
  "Bodega principal",
  "Patio",
  "Taller",
  "Almacén de herramientas",
  "Zona de equipos",
  "Sin ubicación",
];

function FieldHelp({ label, example }: { label: string; example: string }) {
  return (
    <span className="field-label-with-help">
      <label>{label}</label>
      <span className="field-help-icon">
        <button
          type="button"
          className="field-help-trigger"
          aria-label={`Ayuda para ${label}`}
        >
          ?
        </button>
        <span className="field-help-tooltip" role="tooltip">
          {example}
        </span>
      </span>
    </span>
  );
}

export function CountsWorkspace({ products }: Props) {
  const [query, setQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [countId, setCountId] = useState("");
  const [status, setStatus] = useState("");
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(
    null,
  );
  const [articleDraft, setArticleDraft] = useState<ArticleDraft | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("location");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [countScope, setCountScope] = useState<CountScope>("all");
  const [scopeValue, setScopeValue] = useState("");
  const [sessionReason, setSessionReason] = useState("");
  const [activeSession, setActiveSession] = useState<CountSession | null>(null);
  const [history, setHistory] = useState<CountSession[]>([]);
  const scopedProducts = useMemo(() => {
    if (countScope === "location" && scopeValue)
      return products.filter((product) => product.location === scopeValue);
    if (countScope === "category" && scopeValue)
      return products.filter((product) => product.category === scopeValue);
    return products;
  }, [products, countScope, scopeValue]);
  const rows = useMemo(
    () =>
      scopedProducts
        .filter((p) =>
          `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          const lineA = lines[a.id];
          const lineB = lines[b.id];
          const status = (line?: Line) =>
            !line || line.quantity === "" ? 0 : line.cost === "" ? 1 : 2;
          const value = (product: StockProduct, line?: Line) =>
            sortKey === "location"
              ? (line?.location || product.location).toLocaleLowerCase("es-CO")
              : sortKey === "quantity"
                ? Number(line?.quantity ?? product.available)
                : sortKey === "cost"
                  ? Number(line?.cost ?? product.unitCost ?? 0)
                  : status(line);
          const left = value(a, lineA);
          const right = value(b, lineB);
          const compared =
            typeof left === "string" && typeof right === "string"
              ? left.localeCompare(right, "es-CO")
              : Number(left) - Number(right);
          return sortDirection === "asc" ? compared : -compared;
        })
        .slice(0, 120),
    [scopedProducts, query, lines, sortKey, sortDirection],
  );
  const knownValues = useMemo(() => {
    const unique = (values: Array<string | undefined | null>) => {
      const normalized = new Map<string, string>();
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .forEach((value) =>
          normalized.set(value.toLocaleLowerCase("es-CO"), value),
        );
      return [...normalized.values()].sort((a, b) =>
        a.localeCompare(b, "es-CO"),
      );
    };
    const defaultUnitList = [
      "unidad",
      "und",
      "metro",
      "m",
      "kilogramo",
      "kg",
      "galón",
      "gal",
      "litro",
      "L",
      "par",
      "metro cuadrado (m²)",
      "m²",
      "metro cúbico (m³)",
      "m³",
      "gramo",
      "g",
      "bulto",
      "caja",
      "caneca",
      "rollo",
      "bolsa",
      "tubo",
    ];
    return {
      categories: unique(products.map((product) => product.category)),
      brands: unique(products.map((product) => product.brand)),
      references: unique(products.map((product) => product.technicalReference)),
      models: unique(products.map((product) => product.model)),
      units: unique([
        ...defaultUnitList,
        ...inventoryUnits.map((u) => u.name.toLowerCase()),
        ...inventoryUnits.map((u) => u.symbol),
        ...products.map((product) => product.unit),
      ]),
      purchaseUnits: unique([
        ...purchasePresentations,
        ...products.map((product) => product.purchaseUnit),
      ]),
      locations: unique([
        ...standardLocations,
        ...products.map((product) => product.location),
      ]),
    };
  }, [products]);

  // ─── Cascada: Categoría → Marca, Unidad ─────────────────────────────────
  const filteredByCategory = useMemo(() => {
    const catQuery =
      articleDraft?.category?.trim().toLocaleLowerCase("es-CO") ?? "";
    if (!catQuery) return products;
    return products.filter(
      (p) => p.category?.trim().toLocaleLowerCase("es-CO") === catQuery,
    );
  }, [products, articleDraft?.category]);

  /** Marcas disponibles para la categoría seleccionada */
  const brandsForCategory = useMemo(() => {
    const unique = new Map<string, string>();
    filteredByCategory
      .map((p) => p.brand?.trim())
      .filter((v): v is string => Boolean(v) && v !== "Sin marca")
      .forEach((v) => unique.set(v.toLocaleLowerCase("es-CO"), v));
    return [...unique.values()].sort((a, b) => a.localeCompare(b, "es-CO"));
  }, [filteredByCategory]);

  /** Unidades sugeridas para la categoría seleccionada */
  const unitsForCategory = useMemo(() => {
    const defaultUnitList = [
      "unidad",
      "und",
      "metro",
      "m",
      "kilogramo",
      "kg",
      "galón",
      "gal",
      "litro",
      "L",
      "par",
      "m²",
      "m³",
      "gramo",
      "g",
    ];
    const fromCategory = filteredByCategory
      .map((p) => p.unit?.trim())
      .filter((v): v is string => Boolean(v));
    const unique = new Map<string, string>();
    [...defaultUnitList, ...fromCategory].forEach((v) =>
      unique.set(v.toLocaleLowerCase("es-CO"), v),
    );
    return [...unique.values()].sort((a, b) => a.localeCompare(b, "es-CO"));
  }, [filteredByCategory]);

  // ─── Cascada: Marca → Modelo, Referencia ────────────────────────────────
  /** Modelos y referencias filtrados por la marca actualmente escrita en el draft */
  const filteredByBrand = useMemo(() => {
    const brandQuery =
      articleDraft?.brand?.trim().toLocaleLowerCase("es-CO") ?? "";
    if (!brandQuery) return filteredByCategory;
    return filteredByCategory.filter(
      (p) => p.brand?.trim().toLocaleLowerCase("es-CO") === brandQuery,
    );
  }, [filteredByCategory, articleDraft?.brand]);

  const modelsForBrand = useMemo(() => {
    const unique = new Map<string, string>();
    filteredByBrand
      .map((p) => p.model?.trim())
      .filter((v): v is string => Boolean(v))
      .forEach((v) => unique.set(v.toLocaleLowerCase("es-CO"), v));
    return [...unique.values()].sort((a, b) => a.localeCompare(b, "es-CO"));
  }, [filteredByBrand]);

  // ─── Cascada: Marca + Modelo → Referencia ───────────────────────────────
  const filteredByModel = useMemo(() => {
    const modelQuery =
      articleDraft?.model?.trim().toLocaleLowerCase("es-CO") ?? "";
    if (!modelQuery) return filteredByBrand;
    return filteredByBrand.filter(
      (p) => p.model?.trim().toLocaleLowerCase("es-CO") === modelQuery,
    );
  }, [filteredByBrand, articleDraft?.model]);

  const referencesForBrand = useMemo(() => {
    const unique = new Map<string, string>();
    filteredByModel
      .map((p) => p.technicalReference?.trim())
      .filter((v): v is string => Boolean(v))
      .forEach((v) => unique.set(v.toLocaleLowerCase("es-CO"), v));
    return [...unique.values()].sort((a, b) => a.localeCompare(b, "es-CO"));
  }, [filteredByModel]);
  const client = () =>
    isSupabaseConfigured && supabaseUrl && supabasePublishableKey
      ? createBrowserClient(supabaseUrl, supabasePublishableKey)
      : null;

  useEffect(() => {
    const supabase = client();
    if (!supabase) return;
    void supabase
      .from("physical_counts")
      .select("id,reason,status,counted_at,approved_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) =>
        setHistory(
          (data ?? []).map((row) => ({
            id: row.id,
            reason: row.reason,
            status: row.status,
            countedAt: row.counted_at,
            approvedAt: row.approved_at,
          })),
        ),
      );
  }, []);

  async function startSession() {
    const supabase = client();
    if (!supabase || !scopedProducts[0]) {
      setStatus("No hay artículos dentro del alcance seleccionado.");
      return;
    }
    const { data: stock, error: stockError } = await supabase
      .from("inventory_stock")
      .select("company_id,branch_id")
      .eq("id", scopedProducts[0].id)
      .single();
    if (stockError || !stock) {
      setStatus(stockError?.message ?? "No se identificó la sede del conteo.");
      return;
    }
    const scopeLabel = countScope === "all" ? "Toda la bodega" : `${countScope === "location" ? "Ubicación" : "Categoría"}: ${scopeValue}`;
    const reason = sessionReason.trim() || `Conteo físico · ${scopeLabel}`;
    const { data, error } = await supabase
      .from("physical_counts")
      .insert({ company_id: stock.company_id, branch_id: stock.branch_id, reason })
      .select("id,reason,status,counted_at,approved_at")
      .single();
    if (error || !data) {
      setStatus(error?.message ?? "No fue posible abrir la jornada.");
      return;
    }
    const session = { id: data.id, reason: data.reason, status: data.status, countedAt: data.counted_at, approvedAt: data.approved_at };
    setCountId(data.id);
    setActiveSession(session);
    setHistory((current) => [session, ...current]);
    setLines({});
    setSessionModalOpen(false);
    setStatus(`Jornada abierta para ${scopedProducts.length} artículo(s).`);
  }
  const defaultLine = (product: StockProduct): Line => ({
    quantity: "",
    cost: "",
    location: product.location === "Sin ubicación" ? "" : product.location,
  });
  const currentLine = editingProduct
    ? (lines[editingProduct.id] ?? defaultLine(editingProduct))
    : null;

  function openArticle(product: StockProduct) {
    setLines((current) =>
      current[product.id]
        ? current
        : { ...current, [product.id]: defaultLine(product) },
    );
    setEditingProduct(product);
    setArticleDraft({
      name: product.name,
      sku: product.sku,
      category: product.category,
      brand: product.brand,
      unit: product.unit,
      reference: product.technicalReference ?? "",
      model: product.model ?? "",
      serial: product.serialNumber ?? "",
      purchaseUnit: product.purchaseUnit ?? "",
      unitsPerPurchase: product.unitsPerPurchase?.toString() ?? "",
      acquiredAt: product.acquiredAt ?? "",
      warrantyUntil: product.warrantyUntil ?? "",
      notes: product.notes ?? "",
    });
  }

  async function ensureCount() {
    if (countId) return countId;
    throw new Error("Abre una nueva jornada de conteo antes de guardar artículos.");
  }

  async function saveLine(product: StockProduct, closeModal = false) {
    const line = lines[product.id];
    if (!line || line.quantity === "") {
      setStatus(
        "Registra la cantidad física para guardar el artículo y su ubicación.",
      );
      return;
    }
    setSaveStatus("saving");
    try {
      const id = await ensureCount();
      const supabase = client();
      if (!supabase) return;
      if (articleDraft && product.itemId) {
        const { error: itemError } = await supabase
          .from("inventory_items")
          .update({
            name: articleDraft.name.trim(),
            sku: articleDraft.sku.trim(),
            category: articleDraft.category.trim() || null,
            brand: articleDraft.brand.trim() || null,
            unit: articleDraft.unit.trim() || null,
            technical_reference: articleDraft.reference.trim() || null,
            model: articleDraft.model.trim() || null,
            serial_number: articleDraft.serial.trim() || null,
            purchase_unit: articleDraft.purchaseUnit.trim() || null,
            units_per_purchase:
              articleDraft.unitsPerPurchase === ""
                ? null
                : Number(articleDraft.unitsPerPurchase),
            acquired_at: articleDraft.acquiredAt || null,
            warranty_until: articleDraft.warrantyUntil || null,
            notes: articleDraft.notes.trim() || null,
          })
          .eq("id", product.itemId);
        if (itemError) throw itemError;
      }
      const { error } = await supabase.from("physical_count_lines").upsert(
        {
          count_id: id,
          stock_id: product.id,
          system_quantity: product.available,
          counted_quantity: Number(line.quantity),
          unit_cost: line.cost === "" ? null : Number(line.cost),
          counted_location: line.location.trim() || null,
          reason: activeSession?.reason ?? "Conteo físico",
        },
        { onConflict: "count_id,stock_id" },
      );
      if (error) throw error;
      setStatus(
        `${product.name} guardado${line.cost === "" ? " como pendiente de valorar" : ""}.`,
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
      if (closeModal) {
        setEditingProduct(null);
        setArticleDraft(null);
        setSaveStatus("idle");
      }
    } catch (error) {
      setSaveStatus("error");
      setStatus(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  }

  async function approve() {
    if (!countId || !Object.keys(lines).length) {
      setStatus("Registra al menos un artículo antes de aprobar.");
      return;
    }
    if (
      !window.confirm(
        "Se aplicarán las cantidades y ubicaciones registradas. Los artículos sin costo quedarán pendientes de valorar. ¿Continuar?",
      )
    )
      return;
    const supabase = client();
    if (!supabase) return;
    const { error } = await supabase.rpc("approve_physical_count", {
      target_count: countId,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Jornada conciliada. Las diferencias quedaron registradas como ajustes auditables.");
    setActiveSession(null);
    setHistory((current) => current.map((session) => session.id === countId ? { ...session, status: "approved", approvedAt: new Date().toISOString() } : session));
    setCountId("");
    setLines({});
  }

  const edit = (key: keyof ArticleDraft, value: string) =>
    setArticleDraft((current) =>
      current ? { ...current, [key]: value } : current,
    );
  return (
    <main className="dashboard-content">
      <section className="dashboard-heading">
        <div>
          <p>Operaciones · RFC Enterprise</p>
          <h1>Conteos físicos</h1>
          <small>
            Abre una jornada, define su alcance y registra el conteo real antes
            de conciliar las diferencias contra el inventario del sistema.
          </small>
        </div>
        <div className="counts-heading-actions">
          {activeSession && <span className="count-session-badge">Jornada abierta</span>}
          <button className="btn-cancel" onClick={() => setSessionModalOpen(true)} type="button">
            Nueva jornada
          </button>
          <button className="inventory-action" onClick={() => void approve()} type="button" disabled={!activeSession}>
            Cerrar y conciliar
          </button>
        </div>
      </section>
      <section className="dashboard-panel">
        <p className="panel-intro">
          {activeSession
            ? `${activeSession.reason}. Registra el conteo físico de cada artículo incluido.`
            : "Crea una jornada antes de registrar cantidades. Puedes contar toda la bodega, una ubicación o una categoría."}
        </p>
        <div className="inventory-catalog-controls">
          <label className="search-field">
            Buscar artículo
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre o SKU"
            />
          </label>
          <label className="search-field">
            Ordenar por
            <select
              aria-label="Ordenar artículos"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              <option value="location">Ubicación</option>
              <option value="quantity">Cantidad</option>
              <option value="cost">Costo</option>
              <option value="status">Estado</option>
            </select>
          </label>
          <button
            className="btn-cancel"
            type="button"
            onClick={() =>
              setSortDirection((current) =>
                current === "asc" ? "desc" : "asc",
              )
            }
            aria-label={`Orden ${sortDirection === "asc" ? "ascendente" : "descendente"}`}
          >
            {sortDirection === "asc" ? "Ascendente ↑" : "Descendente ↓"}
          </button>
        </div>
        <div className="inventory-table-container">
          <table className="inventory-data-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Ubicación actual</th>
                <th>Cantidad registrada</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const line = lines[product.id];
                return (
                  <tr key={product.id}>
                    <td>
                      <button
                        className="table-link-button"
                        type="button"
                        onClick={() => openArticle(product)}
                      >
                        <strong>{product.name}</strong>
                        <small>
                          {product.sku} · {product.unit}
                        </small>
                      </button>
                    </td>
                    <td>{line?.location || product.location}</td>
                    <td>
                      {line?.quantity === "" || !line
                        ? "Sin registrar"
                        : line.quantity}
                    </td>
                    <td>
                      {!line || line.quantity === ""
                        ? "Pendiente"
                        : line.cost === ""
                          ? "Pendiente de valorar"
                          : "Listo"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="panel-intro">
          {status ||
            `Mostrando ${rows.length} artículos. Selecciona un artículo para abrir su ficha.`}
        </p>
      </section>
      <section className="counts-history" aria-label="Historial de jornadas">
        <strong>Últimas jornadas</strong>
        {history.length ? (
          <ul>
            {history.slice(0, 4).map((session) => (
              <li key={session.id}>
                <span>{session.reason}</span>
                <small>{session.status === "approved" ? "Conciliada" : "Abierta"} · {new Date(session.countedAt).toLocaleDateString("es-CO")}</small>
              </li>
            ))}
          </ul>
        ) : <p>Aún no hay jornadas registradas.</p>}
      </section>
      {sessionModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="count-session-title">
          <div className="modal-card small">
            <div className="modal-header">
              <div><p>Conteo físico</p><h3 id="count-session-title">Nueva jornada</h3></div>
              <button className="btn-close-modal" type="button" aria-label="Cerrar" onClick={() => setSessionModalOpen(false)}>×</button>
            </div>
            <p className="panel-intro">Elige qué se contará. Las existencias del sistema se compararán solo al cerrar y conciliar.</p>
            <div className="form-group">
              <label htmlFor="count-scope">Alcance</label>
              <select id="count-scope" value={countScope} onChange={(event) => { setCountScope(event.target.value as CountScope); setScopeValue(""); }}>
                <option value="all">Toda la bodega</option>
                <option value="location">Una ubicación</option>
                <option value="category">Una categoría</option>
              </select>
            </div>
            {countScope !== "all" && (
              <div className="form-group">
                <label htmlFor="count-scope-value">{countScope === "location" ? "Ubicación" : "Categoría"}</label>
                <select id="count-scope-value" value={scopeValue} onChange={(event) => setScopeValue(event.target.value)} required>
                  <option value="">Selecciona una opción</option>
                  {(countScope === "location" ? knownValues.locations : knownValues.categories).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="count-reason">Observación de la jornada</label>
              <input id="count-reason" value={sessionReason} onChange={(event) => setSessionReason(event.target.value)} placeholder="Ej.: Inventario mensual de bodega principal" />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" type="button" onClick={() => setSessionModalOpen(false)}>Cancelar</button>
              <button className="inventory-action" type="button" disabled={countScope !== "all" && !scopeValue} onClick={() => void startSession()}>Abrir jornada</button>
            </div>
          </div>
        </div>
      )}
      {editingProduct && currentLine && articleDraft ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="initial-count-item-title"
        >
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <p>
                  Ficha de artículo
                  {saveStatus === "saving" && (
                    <span
                      style={{
                        marginLeft: "10px",
                        color: "#6b7280",
                        fontSize: "13px",
                      }}
                    >
                      Guardando... ⏳
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span
                      style={{
                        marginLeft: "10px",
                        color: "#10b981",
                        fontSize: "13px",
                      }}
                    >
                      Guardado ✓
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span
                      style={{
                        marginLeft: "10px",
                        color: "#ef4444",
                        fontSize: "13px",
                      }}
                    >
                      Error al guardar ⚠️
                    </span>
                  )}
                </p>
                <h3 id="initial-count-item-title">
                  {articleDraft.name || "Artículo sin nombre"}
                </h3>
              </div>
              <button
                className="btn-close-modal"
                aria-label="Cerrar"
                onClick={() => {
                  setEditingProduct(null);
                  setArticleDraft(null);
                }}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <FieldHelp
                  label="Nombre *"
                  example="Disco de corte 4½ pulgadas"
                />
                <input
                  value={articleDraft.name}
                  onChange={(e) => edit("name", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="SKU / código"
                  example="DIS-4.5-ACERO o código de barras"
                />
                <input
                  value={articleDraft.sku}
                  onChange={(e) => edit("sku", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Categoría"
                  example="Abrasivos, herramienta o tubería"
                />
                <input
                  list="initial-count-categories"
                  value={articleDraft.category}
                  onChange={(e) => {
                    // Al cambiar categoría, limpiar marca, modelo y referencia
                    setArticleDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            category: e.target.value,
                            brand: "",
                            model: "",
                            reference: "",
                          }
                        : prev,
                    );
                  }}
                  placeholder={
                    knownValues.categories.length > 0
                      ? `${knownValues.categories.length} categoría(s) en catálogo`
                      : "Escribe o crea una categoría"
                  }
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Marca"
                  example="Bosch, Truper o fabricante real"
                />
                <input
                  list="initial-count-brands-filtered"
                  value={articleDraft.brand}
                  onChange={(e) => {
                    // Al cambiar marca, limpiar modelo y referencia para evitar inconsistencias
                    setArticleDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            brand: e.target.value,
                            model: "",
                            reference: "",
                          }
                        : prev,
                    );
                  }}
                  placeholder={
                    brandsForCategory.length > 0
                      ? `${brandsForCategory.length} marca(s) en esta categoría`
                      : "Escribe o crea una marca"
                  }
                />
                <datalist id="initial-count-brands-filtered">
                  {brandsForCategory.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Modelo"
                  example="GWS 750-100 para una pulidora"
                />
                <input
                  list="initial-count-models-filtered"
                  value={articleDraft.model}
                  onChange={(e) => edit("model", e.target.value)}
                  placeholder={
                    modelsForBrand.length > 0
                      ? `${modelsForBrand.length} modelo(s) disponibles`
                      : "Escribe el modelo"
                  }
                />
                <datalist id="initial-count-models-filtered">
                  {modelsForBrand.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Referencia técnica"
                  example="A24R-BF o referencia del fabricante"
                />
                <input
                  list="initial-count-references-filtered"
                  value={articleDraft.reference}
                  onChange={(e) => edit("reference", e.target.value)}
                  placeholder={
                    referencesForBrand.length > 0
                      ? `${referencesForBrand.length} referencia(s) disponibles`
                      : "Escribe la referencia"
                  }
                />
                <datalist id="initial-count-references-filtered">
                  {referencesForBrand.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Serial"
                  example="Solo para equipo serializado"
                />
                <input
                  value={articleDraft.serial}
                  onChange={(e) => edit("serial", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Unidad de consumo"
                  example="unidad, metro, kilogramo o galón"
                />
                <input
                  list="initial-count-units-filtered"
                  value={articleDraft.unit}
                  onChange={(e) => edit("unit", e.target.value)}
                  placeholder={"unidad, metro, kg, galón…"}
                />
                <datalist id="initial-count-units-filtered">
                  {unitsForCategory.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Presentación de compra"
                  example="caja, bulto, rollo o caneca"
                />
                <input
                  list="initial-count-purchase-units"
                  value={articleDraft.purchaseUnit}
                  placeholder="Ej. caja"
                  onChange={(e) => edit("purchaseUnit", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Contenido por presentación"
                  example="Caja de 100 unidades = 100"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={articleDraft.unitsPerPurchase}
                  onChange={(e) => edit("unitsPerPurchase", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Fecha de adquisición"
                  example="Fecha de factura o compra, si se conoce"
                />
                <input
                  type="date"
                  value={articleDraft.acquiredAt}
                  onChange={(e) => edit("acquiredAt", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Garantía hasta"
                  example="Vencimiento indicado por el proveedor"
                />
                <input
                  type="date"
                  value={articleDraft.warrantyUntil}
                  onChange={(e) => edit("warrantyUntil", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Ubicación física actual"
                  example="Bodega principal · Estantería 4 · Nivel 2"
                />
                <input
                  autoFocus
                  list="initial-count-locations"
                  value={currentLine.location}
                  placeholder="Bodega · Estantería · Nivel"
                  onBlur={() => void saveLine(editingProduct)}
                  onChange={(e) =>
                    setLines((current) => ({
                      ...current,
                      [editingProduct.id]: {
                        ...currentLine,
                        location: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div
                className="form-group"
                style={{
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <FieldHelp
                  label={`Cantidad física (${articleDraft.unit || editingProduct.unit}) *`}
                  example="48 unidades encontradas al contar"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={currentLine.quantity}
                  placeholder="Cuenta real"
                  style={{ fontSize: "1.1em", fontWeight: "bold" }}
                  onBlur={() => void saveLine(editingProduct)}
                  onChange={(e) =>
                    setLines((current) => ({
                      ...current,
                      [editingProduct.id]: {
                        ...currentLine,
                        quantity: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div
                className="form-group"
                style={{
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <FieldHelp
                  label="Costo unitario COP (opcional)"
                  example="12.500 por unidad; vacío si se desconoce"
                />
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ fontWeight: "bold", color: "#64748b" }}>
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={currentLine.cost}
                    placeholder="Déjalo vacío si se desconoce"
                    style={{ flex: 1, fontSize: "1.1em" }}
                    onBlur={() => void saveLine(editingProduct)}
                    onChange={(e) =>
                      setLines((current) => ({
                        ...current,
                        [editingProduct.id]: {
                          ...currentLine,
                          cost: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Notas"
                  example="Equipo pendiente de mantenimiento"
                />
                <input
                  value={articleDraft.notes}
                  onChange={(e) => edit("notes", e.target.value)}
                />
              </div>
            </div>
            <datalist id="initial-count-categories">
              {knownValues.categories.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="initial-count-brands">
              {knownValues.brands.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="initial-count-references">
              {knownValues.references.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="initial-count-models">
              {knownValues.models.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="initial-count-units">
              {knownValues.units.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="initial-count-purchase-units">
              {knownValues.purchaseUnits.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="initial-count-locations">
              {knownValues.locations.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <p className="panel-intro">
              Los datos técnicos se guardan con el artículo. Si no conoces el
              costo antiguo, déjalo vacío.
            </p>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setEditingProduct(null);
                  setArticleDraft(null);
                }}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="inventory-action"
                onClick={() => void saveLine(editingProduct, true)}
                type="button"
              >
                Guardar ficha y conteo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
