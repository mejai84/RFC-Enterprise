"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import type { StockProduct } from "@/modules/inventory";

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
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [countId, setCountId] = useState("");
  const [status, setStatus] = useState("");
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(
    null,
  );
  const [articleDraft, setArticleDraft] = useState<ArticleDraft | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("location");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const rows = useMemo(
    () =>
      products
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
    [products, query, lines, sortKey, sortDirection],
  );
  const knownValues = useMemo(() => {
    const unique = (values: Array<string | undefined | null>) =>
      [
        ...new Set(
          values
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((a, b) => a.localeCompare(b, "es-CO"));
    return {
      categories: unique(products.map((product) => product.category)),
      brands: unique(products.map((product) => product.brand)),
      references: unique(products.map((product) => product.technicalReference)),
      models: unique(products.map((product) => product.model)),
      units: unique(products.map((product) => product.unit)),
      purchaseUnits: unique(products.map((product) => product.purchaseUnit)),
      locations: unique(products.map((product) => product.location)),
    };
  }, [products]);
  const client = () =>
    isSupabaseConfigured && supabaseUrl && supabasePublishableKey
      ? createBrowserClient(supabaseUrl, supabasePublishableKey)
      : null;
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
    const supabase = client();
    if (!supabase || !products[0])
      throw new Error("No hay conexión o artículos disponibles.");
    const { data: stock, error: stockError } = await supabase
      .from("inventory_stock")
      .select("company_id,branch_id")
      .eq("id", products[0].id)
      .single();
    if (stockError || !stock)
      throw stockError ?? new Error("No se identificó la bodega.");
    const { data, error } = await supabase
      .from("physical_counts")
      .insert({
        company_id: stock.company_id,
        branch_id: stock.branch_id,
        reason: "Carga inicial de inventario",
      })
      .select("id")
      .single();
    if (error || !data)
      throw error ?? new Error("No fue posible iniciar la carga.");
    setCountId(data.id);
    return data.id;
  }

  async function saveLine(product: StockProduct, closeModal = false) {
    const line = lines[product.id];
    if (!line || line.quantity === "") {
      setStatus(
        "Registra la cantidad física para guardar el artículo y su ubicación.",
      );
      return;
    }
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
          reason: "Carga inicial",
        },
        { onConflict: "count_id,stock_id" },
      );
      if (error) throw error;
      setStatus(
        `${product.name} guardado${line.cost === "" ? " como pendiente de valorar" : ""}.`,
      );
      if (closeModal) {
        setEditingProduct(null);
        setArticleDraft(null);
      }
    } catch (error) {
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
    const { error } = await supabase.rpc("approve_initial_inventory_count", {
      target_count: countId,
    });
    setStatus(
      error?.message ??
        "Carga inicial aprobada. Los artículos sin costo quedaron pendientes de valorar.",
    );
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
          <h1>Carga inicial de inventario</h1>
          <small>
            Selecciona cada artículo para abrir su ficha completa, actualizar su
            información y registrar el conteo real.
          </small>
        </div>
        <button
          className="inventory-action"
          onClick={() => void approve()}
          type="button"
        >
          Aprobar carga inicial
        </button>
      </section>
      <section className="dashboard-panel">
        <p className="panel-intro">
          La ficha permite corregir la información técnica, ubicación y valor.
          Un costo vacío queda pendiente de valorar.
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
                <p>Ficha de artículo</p>
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
                  onChange={(e) => edit("category", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Marca"
                  example="Bosch, Truper o fabricante real"
                />
                <input
                  list="initial-count-brands"
                  value={articleDraft.brand}
                  onChange={(e) => edit("brand", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Referencia técnica"
                  example="A24R-BF o referencia del fabricante"
                />
                <input
                  list="initial-count-references"
                  value={articleDraft.reference}
                  onChange={(e) => edit("reference", e.target.value)}
                />
              </div>
              <div className="form-group">
                <FieldHelp
                  label="Modelo"
                  example="GWS 750-100 para una pulidora"
                />
                <input
                  list="initial-count-models"
                  value={articleDraft.model}
                  onChange={(e) => edit("model", e.target.value)}
                />
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
                  list="initial-count-units"
                  value={articleDraft.unit}
                  onChange={(e) => edit("unit", e.target.value)}
                />
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
              <div className="form-group">
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
              <div className="form-group">
                <FieldHelp
                  label="Costo unitario COP (opcional)"
                  example="12.500 por unidad; vacío si se desconoce"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={currentLine.cost}
                  placeholder="Déjalo vacío si se desconoce"
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
