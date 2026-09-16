"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  inventoryProducts,
  inventoryProjects,
  inventorySourceSummary,
  sampleInitialMovements,
  type StockProduct,
  type Project,
  type InventoryMovement,
  type MovementType,
} from "../index";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO");

const movementLabels: Record<MovementType, string> = {
  entry: "Entrada a Bodega",
  exit: "Salida para Obra",
  adjustment: "Ajuste de Inventario",
  return: "DevoluciÃ³n a Bodega",
};

type TabKey = "catalog" | "movements" | "projects" | "low-stock";

function formatDateTime() {
  const date = new Date();
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function stockState(product: StockProduct) {
  if (product.available <= 0) return { className: "out", label: "Agotado" };
  if (product.minimum !== null && product.available <= product.minimum) {
    return { className: "low", label: "Bajo mínimo" };
  }
  return { className: "ok", label: "Disponible" };
}

type Props = {
  initialProducts?: StockProduct[];
  dataSource?: "demo" | "database";
  loadError?: string;
  initialTab?: TabKey;
  mode?: "inventory" | "movements";
};

export function InventoryWorkspace({ initialProducts, dataSource = "demo", loadError, initialTab = "catalog", mode = "inventory" }: Props) {
  const isMovementsView = mode === "movements";
  // Inicialización con persistencia en localStorage
  const [products, setProducts] = useState<StockProduct[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_products");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return initialProducts && initialProducts.length > 0 ? initialProducts : [...inventoryProducts];
  });

  const [movements, setMovements] = useState<InventoryMovement[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_movements");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return [...sampleInitialMovements];
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_projects");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return [...inventoryProjects];
  });

  // Guardar en localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rfc_inventory_products", JSON.stringify(products));
      localStorage.setItem("rfc_inventory_movements", JSON.stringify(movements));
      localStorage.setItem("rfc_inventory_projects", JSON.stringify(projects));
    }
  }, [products, movements, projects]);

  // Estados de navegación e interfaz
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");
  const [movementProjectFilter, setMovementProjectFilter] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Estados del modal de movimientos
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [movementType, setMovementType] = useState<MovementType>("exit");
  const [quantityInput, setQuantityInput] = useState<string>("1");
  const [unitCostInput, setUnitCostInput] = useState<string>("");
  const [referenceInput, setReferenceInput] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [responsibleInput, setResponsibleInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Estado del modal de nueva obra / proyecto
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectCode, setNewProjectCode] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectClient, setNewProjectClient] = useState("");
  const [newProjectLocation, setNewProjectLocation] = useState("");
  const [newProjectBudget, setNewProjectBudget] = useState("");

  // Estado del modal de edición de stock mínimo
  const [editingMinimumProduct, setEditingMinimumProduct] = useState<StockProduct | null>(null);
  const [newMinimumValue, setNewMinimumValue] = useState("");

  // Producto seleccionado actualmente en el modal
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Cálculos consolidados de KPIs
  const totalUnits = useMemo(() => products.reduce((sum, p) => sum + p.available, 0), [products]);
  const totalValuation = useMemo(
    () => products.reduce((sum, p) => sum + p.available * (p.unitCost || 25000), 0),
    [products]
  );
  const totalProjectExpenses = useMemo(
    () => movements.filter((m) => m.type === "exit").reduce((sum, m) => sum + (m.totalCost || 0), 0),
    [movements]
  );
  const lowStockCount = useMemo(
    () => products.filter((p) => p.minimum !== null && p.available <= p.minimum).length,
    [products]
  );

  // Filtrado de productos del catálogo
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (groupFilter !== "all" && p.inventoryGroup !== groupFilter) return false;
      if (stockFilter === "low" && (p.minimum === null || p.available > p.minimum)) return false;
      if (stockFilter === "out" && p.available > 0) return false;
      if (stockFilter === "available" && p.available <= 0) return false;
      if (!q) return true;
      const haystack = `${p.name} ${p.sku} ${p.category} ${p.brand} ${p.location}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [products, query, groupFilter, stockFilter]);

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Filtrado de movimientos
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (movementTypeFilter !== "all" && m.type !== movementTypeFilter) return false;
      if (movementProjectFilter !== "all" && m.projectId !== movementProjectFilter) return false;
      return true;
    });
  }, [movements, movementTypeFilter, movementProjectFilter]);

  // Resumen de gasto por proyecto
  const projectExpenses = useMemo(() => {
    const map = new Map<string, { totalCost: number; movementsCount: number; itemsList: InventoryMovement[] }>();
    projects.forEach((prj) => map.set(prj.id, { totalCost: 0, movementsCount: 0, itemsList: [] }));

    movements.forEach((m) => {
      if (m.type === "exit" && m.projectId) {
        const current = map.get(m.projectId) || { totalCost: 0, movementsCount: 0, itemsList: [] };
        current.totalCost += m.totalCost || 0;
        current.movementsCount += 1;
        current.itemsList.push(m);
        map.set(m.projectId, current);
      }
    });
    return map;
  }, [projects, movements]);

  // Mostrar toast auto-ocultable
  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  }

  // Abrir modal de movimiento con producto precargado
  function openMovementModal(product?: StockProduct, defaultType: MovementType = "exit") {
    const target = product;
    if (target) {
      setSelectedProductId(target.id);
      setModalSearch(target.name);
      setUnitCostInput(String(target.unitCost || 25000));
    } else {
      // Una entrada iniciada desde el encabezado debe obligar a elegir el artículo.
      // No se permite registrar por accidente sobre el primer elemento del catálogo.
      setSelectedProductId("");
      setModalSearch("");
      setUnitCostInput("");
    }
    setShowAutocomplete(false);
    setMovementType(defaultType);
    setQuantityInput("1");
    setReferenceInput(defaultType === "exit" ? `VALE-2026-${String(movements.length + 1).padStart(3, "0")}` : "DOC-2026-01");
    setSelectedProjectId(projects[0]?.id || "");
    setResponsibleInput("");
    setNotesInput("");
    setFormError(null);
    setIsMovementModalOpen(true);
  }

  // Al seleccionar producto en el modal
  function handleSelectProductInModal(p: StockProduct) {
    setSelectedProductId(p.id);
    setModalSearch(p.name);
    setUnitCostInput(String(p.unitCost || 25000));
    setShowAutocomplete(false);
  }

  // Ejecutar registro de movimiento con validaciones
  function handleSaveMovement(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const qty = Number(quantityInput);
    const unitCost = Number(unitCostInput) || (selectedProduct?.unitCost || 25000);
    const ref = referenceInput.trim();

    if (!selectedProduct) {
      setFormError("Por favor selecciona un artículo válido.");
      return;
    }
    if (!qty || qty <= 0 || !Number.isFinite(qty)) {
      setFormError("La cantidad debe ser un número positivo mayor a cero.");
      return;
    }
    if (!ref) {
      setFormError("Ingresa un número de documento, orden o vale de referencia.");
      return;
    }

    const delta = movementType === "entry" ? qty : movementType === "exit" ? -qty : qty;
    if (movementType === "exit" && selectedProduct.available - qty < 0) {
      setFormError(
        `No hay existencias suficientes. Stock actual: ${selectedProduct.available} ${selectedProduct.unit}, intentas retirar: ${qty} ${selectedProduct.unit}.`
      );
      return;
    }

    const project = projects.find((prj) => prj.id === selectedProjectId);
    if (movementType === "exit" && (!project || project.status !== "active")) {
      setFormError("Selecciona una obra activa. No se pueden despachar materiales a obras finalizadas, pendientes o en pausa.");
      return;
    }
    const totalCost = Math.abs(qty * unitCost);

    const newMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: movementType,
      quantity: qty,
      unit: selectedProduct.unit,
      unitCost,
      totalCost,
      occurredAt: formatDateTime(),
      reference: ref,
      projectId: movementType === "exit" ? project?.id : undefined,
      projectName: movementType === "exit" ? project?.name : undefined,
      responsible: responsibleInput.trim() || undefined,
      notes: notesInput.trim() || undefined,
    };

    // Actualizar producto en inventario
    setProducts((current) =>
      current.map((p) =>
        p.id === selectedProduct.id
          ? { ...p, available: Math.max(0, p.available + delta), unitCost }
          : p
      )
    );

    // Agregar movimiento al inicio
    setMovements((current) => [newMovement, ...current]);
    setIsMovementModalOpen(false);

    const msg =
      movementType === "exit"
        ? `Salida de ${qty} ${selectedProduct.unit} de "${selectedProduct.name}" registrada para ${project ? project.name : "obra"}. Costo: ${currencyFormatter.format(totalCost)}.`
        : movementType === "entry"
        ? `Entrada de ${qty} ${selectedProduct.unit} agregada a bodega exitosamente.`
        : `Ajuste de inventario aplicado a "${selectedProduct.name}".`;

    showToast(msg, "success");
  }

  // Crear nuevo proyecto / obra
  function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectCode.trim()) {
      showToast("Completa el código y nombre de la obra.", "error");
      return;
    }

    const newPrj: Project = {
      id: `prj-${Date.now()}`,
      code: newProjectCode.trim().toUpperCase(),
      name: newProjectName.trim(),
      client: newProjectClient.trim() || "Representaciones Figueroa",
      location: newProjectLocation.trim() || "Caucasia, Antioquia",
      budget: Number(newProjectBudget) || 10000000,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0],
    };

    setProjects((current) => [newPrj, ...current]);
    setIsProjectModalOpen(false);
    setNewProjectCode("");
    setNewProjectName("");
    setNewProjectClient("");
    setNewProjectLocation("");
    setNewProjectBudget("");
    showToast(`Obra "${newPrj.name}" creada con presupuesto de ${currencyFormatter.format(newPrj.budget)}.`, "success");
  }

  // Guardar nuevo stock mínimo
  function handleSaveMinimum(e: FormEvent) {
    e.preventDefault();
    if (!editingMinimumProduct) return;

    const parsedMin = newMinimumValue.trim() === "" ? null : Number(newMinimumValue);
    if (parsedMin !== null && (isNaN(parsedMin) || parsedMin < 0)) {
      showToast("Ingresa un valor válido o déjalo vacío.", "error");
      return;
    }

    setProducts((current) =>
      current.map((p) =>
        p.id === editingMinimumProduct.id ? { ...p, minimum: parsedMin } : p
      )
    );

    showToast(`Nivel mínimo de "${editingMinimumProduct.name}" actualizado a ${parsedMin ?? "Sin mínimo"}.`);
    setEditingMinimumProduct(null);
  }

  // Exportar kardex a CSV compatible con Excel
  function exportMovementsCSV() {
    if (movements.length === 0) {
      showToast("No hay movimientos para exportar.", "error");
      return;
    }

    const headers = [
      "ID Movimiento",
      "Fecha",
      "Tipo",
      "Referencia / Vale",
      "Artículo",
      "Cantidad",
      "Unidad",
      "Costo Unitario (COP)",
      "Costo Total (COP)",
      "Obra / Proyecto Destino",
      "Responsable",
      "Notas",
    ];

    const rows = movements.map((m) => [
      `"${m.id}"`,
      `"${m.occurredAt}"`,
      `"${movementLabels[m.type]}"`,
      `"${m.reference}"`,
      `"${m.productName || ""}"`,
      m.quantity,
      `"${m.unit || ""}"`,
      m.unitCost,
      m.totalCost,
      `"${m.projectName || "Almacén Central"}"`,
      `"${m.responsible || ""}"`,
      `"${m.notes || ""}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RFC_Movimientos_Inventario_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Archivo CSV de movimientos generado y descargado.", "success");
  }

  return (
    <main className="dashboard-content inventory-workspace-pro">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`inventory-toast ${toastMessage.type}`} role="status">
          <span>{toastMessage.type === "success" ? "✓" : "⚠"}</span>
          <p>{toastMessage.text}</p>
        </div>
      )}

      {/* Encabezado y Acción Principal */}
      <section className="dashboard-heading">
        <div>
          <p>Módulo de Operaciones · RFC Enterprise</p>
          <h1>{isMovementsView ? "Kardex de Movimientos" : "Control de Inventario"}</h1>
          <small>
            {isMovementsView ? "Consulta y registra entradas, salidas, ajustes y devoluciones de inventario." : `Catálogo activo con ${numberFormatter.format(products.length)} artículos y existencias disponibles.`}
          </small>
        </div>
        <div className="header-actions">
          {isMovementsView ? (
            <button className="inventory-action" onClick={() => openMovementModal()} type="button">+ Registrar movimiento</button>
          ) : (
            <>
              <button className="inventory-action secondary" onClick={() => openMovementModal(undefined, "entry")} type="button">+ Registrar entrada</button>
              <button className="inventory-action" onClick={() => openMovementModal(undefined, "exit")} type="button">+ Registrar salida</button>
            </>
          )}
        </div>
      </section>

      {/* Aviso de Conexión */}
      {dataSource === "demo" ? (
        <p className="inventory-session-notice">
          Modo Local Activo: Todos los movimientos, obras y ajustes se guardan en tiempo real en tu navegador.
        </p>
      ) : (
        <p className="inventory-session-notice">
          Conectado a Base de Datos Supabase: Existencias sincronizadas con la nube de RFC Enterprise.
        </p>
      )}

      {loadError && (
        <p className="inventory-feedback error" role="alert">
          {loadError}
        </p>
      )}

      {/* Tarjetas de Indicadores Principales */}
      <section className="inventory-summary-cards" aria-label="Indicadores ejecutivos de inventario">
        <article className="stat-card">
          <span>Artículos en Catálogo</span>
          <strong>{numberFormatter.format(products.length)}</strong>
          <small>{inventorySourceSummary.groups.length} grupos de inventario</small>
        </article>
        <article className="stat-card">
          <span>Unidades Disponibles</span>
          <strong>{numberFormatter.format(totalUnits)}</strong>
          <small>En almacén y frentes de trabajo</small>
        </article>
        <article className="stat-card valuation">
          <span>Valorización de Inventario</span>
          <strong>{currencyFormatter.format(totalValuation)}</strong>
          <small>Valor comercial estimado en bodega</small>
        </article>
        <article className="stat-card project-costs">
          <span>Gasto Total en Obras</span>
          <strong>{currencyFormatter.format(totalProjectExpenses)}</strong>
          <small>{movements.filter((m) => m.type === "exit").length} vales de salida despachados</small>
        </article>
      </section>

      {/* Barra de Pestañas de Navegación */}
      <nav className="inventory-tabs-nav" aria-label="Secciones del módulo">
        {isMovementsView ? (
          <button className="tab-btn active" type="button" aria-current="page">Kardex y Movimientos ({movements.length})</button>
        ) : <>
        <button
          className={`tab-btn ${activeTab === "catalog" ? "active" : ""}`}
          onClick={() => setActiveTab("catalog")}
          type="button"
        >
          📦 Existencias y Catálogo ({filteredProducts.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "projects" ? "active" : ""}`}
          onClick={() => setActiveTab("projects")}
          type="button"
        >
          🏗️ Costos por Proyecto / Obra ({projects.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "movements" ? "active" : ""}`}
          onClick={() => setActiveTab("movements")}
          type="button"
        >
          🔄 Kardex y Movimientos ({movements.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "low-stock" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("low-stock");
            setStockFilter("low");
          }}
          type="button"
        >
          ⚠️ Alertas de Stock Mínimo {lowStockCount > 0 && <span className="tab-badge">{lowStockCount}</span>}
        </button>
        </>}
      </nav>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: CATÁLOGO DE EXISTENCIAS */}
      {/* ========================================================================= */}
      {!isMovementsView && activeTab === "catalog" && (
        <section className="dashboard-panel inventory-catalog-panel">
          <div className="panel-title">
            <div>
              <p>Existencias Físicas</p>
              <h2>Catálogo de Materiales y Herramientas</h2>
            </div>
            <div className="panel-actions">
              <span className="inventory-result-count">
                Mostrando {paginatedProducts.length} de {numberFormatter.format(filteredProducts.length)} artículos
              </span>
            </div>
          </div>

          {/* Filtros y Búsqueda */}
          <div className="inventory-catalog-controls">
            <label className="search-field">
              Buscar artículo
              <input
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Nombre, código, marca, categoría o ubicación…"
                value={query}
              />
            </label>

            <label>
              Grupo de inventario
              <select
                onChange={(e) => {
                  setGroupFilter(e.target.value);
                  setCurrentPage(1);
                }}
                value={groupFilter}
              >
                <option value="all">Todos los grupos</option>
                <option value="bodega">Bodega Principal</option>
                <option value="dotacion">Dotación</option>
                <option value="trabajadores">Herramientas Trabajadores</option>
              </select>
            </label>

            <label>
              Estado de stock
              <select
                onChange={(e) => {
                  setStockFilter(e.target.value);
                  setCurrentPage(1);
                }}
                value={stockFilter}
              >
                <option value="all">Todos los estados</option>
                <option value="available">Disponibles</option>
                <option value="low">Bajo mínimo requerido</option>
                <option value="out">Sin existencias (Agotados)</option>
              </select>
            </label>

            <label>
              Por página
              <select
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                value={pageSize}
              >
                <option value="25">25 artículos</option>
                <option value="50">50 artículos</option>
                <option value="100">100 artículos</option>
              </select>
            </label>
          </div>

          {/* Tabla de Artículos */}
          <div className="inventory-table-container">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>Artículo / Especificación</th>
                  <th>Ubicación</th>
                  <th>Grupo</th>
                  <th style={{ textAlign: "right" }}>Costo Unit. (COP)</th>
                  <th style={{ textAlign: "right" }}>Disponible</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
                      No se encontraron artículos con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p) => {
                    const st = stockState(p);
                    const cost = p.unitCost || 25000;
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <small>
                            {p.sku ? `SKU: ${p.sku} · ` : ""}
                            {p.category} {p.brand ? `· ${p.brand}` : ""}
                          </small>
                        </td>
                        <td>
                          <span className="location-tag">{p.location || "Sin ubicación"}</span>
                        </td>
                        <td>
                          <span className="group-tag">{p.inventoryGroupName}</span>
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {currencyFormatter.format(cost)}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          <b className="stock-quantity">
                            {p.available} <small>{p.unit}</small>
                          </b>
                          {p.minimum !== null && <span className="stock-min-hint">Mín: {p.minimum}</span>}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`status-pill ${st.className}`}>{st.label}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="row-actions">
                            <button
                              className="btn-row-action"
                              onClick={() => openMovementModal(p, "exit")}
                              title="Despachar para obra"
                              type="button"
                            >
                              📤 Despachar
                            </button>
                            <button
                              className="btn-row-action"
                              onClick={() => openMovementModal(p, "entry")}
                              title="Ingresar material a bodega"
                              type="button"
                            >
                              📥 Entrada
                            </button>
                            <button
                              className="btn-row-action subtle"
                              onClick={() => {
                                setEditingMinimumProduct(p);
                                setNewMinimumValue(p.minimum !== null ? String(p.minimum) : "");
                              }}
                              title="Configurar nivel mínimo de stock"
                              type="button"
                            >
                              ⚙️ Mínimo
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="pagination-bar">
              <button
                className="btn-page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                type="button"
              >
                ← Anterior
              </button>
              <span>
                Página <b>{currentPage}</b> de <b>{totalPages}</b>
              </span>
              <button
                className="btn-page"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                type="button"
              >
                Siguiente →
              </button>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: COSTOS POR PROYECTO / OBRA (LO QUE PIDIÓ EL USUARIO) */}
      {/* ========================================================================= */}
      {!isMovementsView && activeTab === "projects" && (
        <section className="dashboard-panel projects-cost-panel">
          <div className="panel-title">
            <div>
              <p>Centro de Costos de Materiales</p>
              <h2>Control de Gasto por Obra y Proyecto</h2>
            </div>
            <button className="inventory-action secondary" onClick={() => setIsProjectModalOpen(true)} type="button">
              + Crear Nueva Obra
            </button>
          </div>

          <p className="panel-intro">
            Consulta en tiempo real cuánto dinero en materiales se ha despachado a cada obra, comparado con el presupuesto
            asignado para evitar sobrecostos.
          </p>

          <div className="projects-grid">
            {projects.map((prj) => {
              const data = projectExpenses.get(prj.id) || { totalCost: 0, movementsCount: 0, itemsList: [] };
              const percent = Math.min(100, Math.round((data.totalCost / (prj.budget || 1)) * 100));
              const isOverBudget = data.totalCost > prj.budget;

              return (
                <article className="project-card" key={prj.id}>
                  <div className="project-card-header">
                    <div>
                      <span className="project-code">{prj.code}</span>
                      <h3>{prj.name}</h3>
                      <p className="project-meta">
                        Cliente: <b>{prj.client}</b> · {prj.location}
                      </p>
                    </div>
                    <span className={`project-status ${prj.status}`}>
                      {prj.status === "active" ? "En Ejecución" : "Completada"}
                    </span>
                  </div>

                  <div className="project-financials">
                    <div className="fin-metric">
                      <span>Presupuesto Materiales</span>
                      <strong>{currencyFormatter.format(prj.budget)}</strong>
                    </div>
                    <div className="fin-metric">
                      <span>Total Material Gastado</span>
                      <strong className={isOverBudget ? "over-cost" : "active-cost"}>
                        {currencyFormatter.format(data.totalCost)}
                      </strong>
                    </div>
                    <div className="fin-metric">
                      <span>Saldo Disponible</span>
                      <strong>{currencyFormatter.format(Math.max(0, prj.budget - data.totalCost))}</strong>
                    </div>
                  </div>

                  {/* Barra de Progreso Presupuestal */}
                  <div className="budget-progress-container">
                    <div className="budget-progress-labels">
                      <span>Ejecución presupuestal: {percent}%</span>
                      <span>{isOverBudget ? "⚠️ Sobrecosto" : `${data.movementsCount} despachos`}</span>
                    </div>
                    <div className="budget-progress-track">
                      <div
                        className={`budget-progress-bar ${isOverBudget ? "danger" : percent > 80 ? "warning" : "ok"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Detalle de materiales despachados */}
                  <div className="project-materials-summary">
                    <h4>Últimos materiales entregados a esta obra:</h4>
                    {data.itemsList.length === 0 ? (
                      <p className="no-items">Aún no se han registrado despachos para esta obra.</p>
                    ) : (
                      <ul className="project-items-list">
                        {data.itemsList.slice(0, 4).map((item) => (
                          <li key={item.id}>
                            <div>
                              <b>{item.productName}</b>
                              <small>
                                {item.quantity} {item.unit} · {item.occurredAt} · {item.reference}
                              </small>
                            </div>
                            <span className="item-cost">{currencyFormatter.format(item.totalCost)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="project-card-footer">
                    <button
                      className="btn-despachar-obra"
                      onClick={() => {
                        setSelectedProjectId(prj.id);
                        openMovementModal(undefined, "exit");
                      }}
                      type="button"
                    >
                      📤 Despachar material a esta obra
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: HISTORIAL DE MOVIMIENTOS (KARDEX) */}
      {/* ========================================================================= */}
      {(isMovementsView || activeTab === "movements") && (
        <section className="dashboard-panel inventory-movements-panel">
          <div className="panel-title">
            <div>
              <p>Trazabilidad y Kardex</p>
              <h2>Historial de Entradas, Salidas y Ajustes</h2>
            </div>
            <button className="inventory-action secondary" onClick={exportMovementsCSV} type="button">
              📥 Descargar Reporte CSV (Excel)
            </button>
          </div>

          {/* Filtros de Movimientos */}
          <div className="inventory-catalog-controls" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
            <label>
              Tipo de movimiento
              <select onChange={(e) => setMovementTypeFilter(e.target.value)} value={movementTypeFilter}>
                <option value="all">Todos los movimientos</option>
                <option value="exit">Salidas a Obra / Proyectos</option>
                <option value="entry">Entradas de Compra / Proveedores</option>
                <option value="adjustment">Ajustes de Inventario</option>
              </select>
            </label>

            <label>
              Filtrar por obra / proyecto
              <select onChange={(e) => setMovementProjectFilter(e.target.value)} value={movementProjectFilter}>
                <option value="all">Todas las obras / Almacén</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="inventory-action" onClick={() => openMovementModal()} type="button">
                + Nuevo Movimiento
              </button>
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="inventory-table-container">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Tipo</th>
                  <th>Documento / Vale</th>
                  <th>Artículo Despachado</th>
                  <th style={{ textAlign: "right" }}>Cantidad</th>
                  <th style={{ textAlign: "right" }}>Costo Unitario</th>
                  <th style={{ textAlign: "right" }}>Costo Total</th>
                  <th>Obra / Destino</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
                      No hay movimientos registrados con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const isExit = m.type === "exit";
                    return (
                      <tr key={m.id}>
                        <td>
                          <small>{m.occurredAt}</small>
                        </td>
                        <td>
                          <span className={`mov-badge ${m.type}`}>
                            {m.type === "entry" ? "↓ Entrada" : m.type === "exit" ? "↑ Salida" : "⚖ Ajuste"}
                          </span>
                        </td>
                        <td>
                          <strong>{m.reference}</strong>
                        </td>
                        <td>
                          <b>{m.productName || "Artículo"}</b>
                          {m.notes && <small className="mov-notes">{m.notes}</small>}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          <span className={`qty-indicator ${isExit ? "neg" : "pos"}`}>
                            {isExit ? "-" : "+"}
                            {m.quantity} {m.unit}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {currencyFormatter.format(m.unitCost || 0)}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          <strong className={isExit ? "cost-exit" : "cost-entry"}>
                            {currencyFormatter.format(m.totalCost || 0)}
                          </strong>
                        </td>
                        <td>
                          {m.projectName ? (
                            <span className="dest-tag">{m.projectName}</span>
                          ) : (
                            <span className="dest-tag almacén">Almacén Central</span>
                          )}
                        </td>
                        <td>
                          <small>{m.responsible || "Personal de Almacén"}</small>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: ALERTAS DE STOCK MÍNIMO */}
      {/* ========================================================================= */}
      {!isMovementsView && activeTab === "low-stock" && (
        <section className="dashboard-panel low-stock-panel">
          <div className="panel-title">
            <div>
              <p>Reposición y Compras</p>
              <h2>Artículos en Punto de Reorden o Críticos</h2>
            </div>
          </div>

          <p className="panel-intro">
            Esta lista agrupa los artículos cuyas existencias están en cero o han caído por debajo de su umbral mínimo
            configurado.
          </p>

          <div className="inventory-table-container">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>Ubicación</th>
                  <th>Grupo</th>
                  <th style={{ textAlign: "right" }}>Existencia Actual</th>
                  <th style={{ textAlign: "right" }}>Mínimo Configurado</th>
                  <th style={{ textAlign: "right" }}>Déficit / Sugerencia Compra</th>
                  <th style={{ textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((p) => p.minimum !== null && p.available <= p.minimum)
                  .map((p) => {
                    const deficit = Math.max(0, (p.minimum || 0) - p.available);
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <small>{p.category}</small>
                        </td>
                        <td>{p.location}</td>
                        <td>{p.inventoryGroupName}</td>
                        <td style={{ textAlign: "right" }}>
                          <b style={{ color: p.available === 0 ? "#b9412d" : "#c49024" }}>
                            {p.available} {p.unit}
                          </b>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {p.minimum} {p.unit}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="deficit-badge">Pedir mín. +{deficit + 5} {p.unit}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="inventory-action"
                            onClick={() => openMovementModal(p, "entry")}
                            style={{ padding: "6px 12px", fontSize: "11px" }}
                            type="button"
                          >
                            📥 Registrar Compra
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR MOVIMIENTO CON COSTEO */}
      {/* ========================================================================= */}
      {isMovementModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <p>Operación de Almacén</p>
                <h3>Registrar Movimiento de Inventario</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setIsMovementModalOpen(false)} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMovement}>
              {/* Selector Visual de Tipo */}
              <div className="movement-type-selector">
                <button
                  type="button"
                  className={`type-option exit ${movementType === "exit" ? "selected" : ""}`}
                  onClick={() => setMovementType("exit")}
                >
                  <span className="type-icon">📤</span>
                  <strong>Salida para Obra</strong>
                  <small>Descuenta existencias y carga costo al proyecto</small>
                </button>
                <button
                  type="button"
                  className={`type-option entry ${movementType === "entry" ? "selected" : ""}`}
                  onClick={() => setMovementType("entry")}
                >
                  <span className="type-icon">📥</span>
                  <strong>Entrada / Compra</strong>
                  <small>Aumenta existencias de bodega</small>
                </button>
                <button
                  type="button"
                  className={`type-option adjustment ${movementType === "adjustment" ? "selected" : ""}`}
                  onClick={() => setMovementType("adjustment")}
                >
                  <span className="type-icon">⚖️</span>
                  <strong>Ajuste Físico</strong>
                  <small>Inventario o merma</small>
                </button>
              </div>

              {/* Buscador Rápido de Artículo */}
              <div className="form-group" style={{ position: "relative" }}>
                <label>
                  {movementType === "entry" ? "Artículo a ingresar" : "Artículo a mover"} <span className="req">*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    placeholder="Busca por nombre, SKU o código de barras…"
                    value={modalSearch}
                    onFocus={() => setShowAutocomplete(true)}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setShowAutocomplete(true);
                    }}
                  />
                  {/* Sugerencias de búsqueda solo si está buscando activamente */}
                  {showAutocomplete && modalSearch.trim().length > 0 && (
                    <div className="autocomplete-results">
                      {products
                        .filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(modalSearch.toLowerCase()))
                        .slice(0, 6)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="autocomplete-item"
                            onClick={() => handleSelectProductInModal(p)}
                          >
                            <div>
                              <strong>{p.name}</strong>
                              <small>
                                {p.inventoryGroupName} · {p.location}
                              </small>
                            </div>
                            <b>
                              Disp: {p.available} {p.unit}
                            </b>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                {selectedProduct && (
                  <div className="selected-product-preview">
                    <span>
                      Artículo seleccionado: <b>{selectedProduct.name}</b>
                    </span>
                    <span>
                      Stock actual en almacén: <b>{selectedProduct.available} {selectedProduct.unit}</b>
                    </span>
                  </div>
                )}
              </div>

              {/* Si es salida, seleccionar Obra / Proyecto de destino */}
              {movementType === "exit" && (
                <div className="form-group">
                  <label>
                    Obra / Proyecto de Destino (Centro de Costos) <span className="req">*</span>
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                  >
                    <option value="">Selecciona una obra activa</option>
                    {projects.map((prj) => (
                      <option key={prj.id} value={prj.id} disabled={prj.status !== "active"}>
                        {prj.code} - {prj.name} ({prj.status === "active" ? "Activa" : prj.status === "completed" ? "Finalizada" : "No disponible"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cantidad y Costo Unitario */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>
                    Cantidad ({selectedProduct?.unit || "unidad"}) <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                  Costo Unitario ($ COP) <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={unitCostInput}
                    onChange={(e) => setUnitCostInput(e.target.value)}
                    placeholder="25000"
                    required
                  />
                </div>
              </div>

              {/* Resumen del Costo Total Calculado */}
              <div className="total-cost-banner">
                <span>{movementType === "exit" ? "Costo total del despacho:" : "Valor total del movimiento:"}</span>
                <strong>
                  {currencyFormatter.format((Number(quantityInput) || 0) * (Number(unitCostInput) || 0))} COP
                </strong>
              </div>

              {/* Documento de Referencia y Responsable */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>
                    N° Vale / Remisión / Factura <span className="req">*</span>
                  </label>
                  <input
                    placeholder="Ej. VALE-2026-04 o FACT-904"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Responsable / Quien recibe</label>
                  <input
                    placeholder="Ej. Carlos Restrepo (Maestro)"
                    value={responsibleInput}
                    onChange={(e) => setResponsibleInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notas u observaciones adicionales</label>
                <input
                  placeholder="Ej. Material para armado de zapatas bloque B"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
              </div>

              {formError && <p className="modal-form-error">{formError}</p>}

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setIsMovementModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="inventory-action" type="submit">
                  Confirmar y Registrar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREAR NUEVA OBRA / PROYECTO */}
      {/* ========================================================================= */}
      {isProjectModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <p>Centro de Costos</p>
                <h3>Crear Nueva Obra / Proyecto</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setIsProjectModalOpen(false)} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Código de la Obra (Ej. OBRA-2026-03)</label>
                  <input
                    placeholder="OBRA-2026-03"
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Presupuesto Materiales ($ COP)</label>
                  <input
                    type="number"
                    step="100000"
                    placeholder="25000000"
                    value={newProjectBudget}
                    onChange={(e) => setNewProjectBudget(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nombre del Proyecto / Obra</label>
                <input
                  placeholder="Ej. Construcción Bodega de Almacenamiento"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Cliente / Contratante</label>
                  <input
                    placeholder="Ej. Alcaldía de Caucasia o Privado"
                    value={newProjectClient}
                    onChange={(e) => setNewProjectClient(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Ubicación de la Obra</label>
                  <input
                    placeholder="Caucasia, Antioquia"
                    value={newProjectLocation}
                    onChange={(e) => setNewProjectLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setIsProjectModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="inventory-action" type="submit">
                  Crear Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: AJUSTAR STOCK MÍNIMO */}
      {/* ========================================================================= */}
      {editingMinimumProduct && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card small">
            <div className="modal-header">
              <div>
                <p>Nivel de Reorden</p>
                <h3>Configurar Stock Mínimo</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setEditingMinimumProduct(null)} type="button">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMinimum}>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "14px" }}>
                Define la cantidad mínima para <b>{editingMinimumProduct.name}</b>. Cuando el stock sea menor o igual a este
                valor, se generará una alerta de reposición.
              </p>

              <div className="form-group">
                <label>Cantidad mínima requerida ({editingMinimumProduct.unit})</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ej. 10"
                  value={newMinimumValue}
                  onChange={(e) => setNewMinimumValue(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setEditingMinimumProduct(null)} type="button">
                  Cancelar
                </button>
                <button className="inventory-action" type="submit">
                  Guardar Nivel Mínimo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
