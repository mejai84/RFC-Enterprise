"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  inventoryProducts,
  inventoryProjects,
  inventoryRequisitions,
  inventoryToolLoans,
  sampleInitialMovements,
  type InventoryMovement,
  type MaterialRequisition,
  type Project,
  type StockProduct,
  type ToolLoan,
} from "../index";
import { PrintableDispatchVoucher } from "./printable-dispatch-voucher";
import { SearchableProductPicker } from "./searchable-product-picker";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO");
const spanishCollator = new Intl.Collator("es-CO", { numeric: true, sensitivity: "base" });

function formatDateTime() {
  const date = new Date();
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DashboardExecutiveWorkspace() {
  // Sincronización con localStorage
  const [products, setProducts] = useState<StockProduct[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_products");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [...inventoryProducts];
  });

  const [movements, setMovements] = useState<InventoryMovement[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_movements");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [...sampleInitialMovements];
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_projects");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [...inventoryProjects];
  });

  const [requisitions, setRequisitions] = useState<MaterialRequisition[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_requisitions");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [...inventoryRequisitions];
  });

  const [toolLoans, setToolLoans] = useState<ToolLoan[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_tool_loans");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [...inventoryToolLoans];
  });

  // Persistir cambios en localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rfc_inventory_products", JSON.stringify(products));
    }
  }, [products]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rfc_inventory_movements", JSON.stringify(movements));
    }
  }, [movements]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rfc_inventory_projects", JSON.stringify(projects));
    }
  }, [projects]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rfc_inventory_requisitions", JSON.stringify(requisitions));
    }
  }, [requisitions]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rfc_inventory_tool_loans", JSON.stringify(toolLoans));
    }
  }, [toolLoans]);

  // Cálculos Financieros y Estadísticas Globales por Obra
  const projectStats = useMemo(() => {
    return projects.map((prj) => {
      const projectMovements = movements.filter((m) => m.projectId === prj.id);
      const spent = projectMovements.reduce((acc, m) => {
        if (m.type === "exit") return acc + m.totalCost;
        if (m.type === "return") return acc - m.totalCost;
        return acc;
      }, 0);

      const remaining = prj.budget - spent;
      const progressPercent = prj.budget > 0 ? Math.min(Math.round((spent / prj.budget) * 100), 100) : 0;
      
      let statusColor = "green";
      if (progressPercent >= 100) statusColor = "red";
      else if (progressPercent >= 80) statusColor = "yellow";

      return {
        ...prj,
        spent,
        remaining,
        progressPercent,
        statusColor,
        movementsCount: projectMovements.length,
        recentMovements: projectMovements.slice(-3).reverse(),
      };
    });
  }, [projects, movements]);

  const globalFinancials = useMemo(() => {
    const totalBudget = projects.reduce((acc, p) => acc + p.budget, 0);
    const totalSpent = projectStats.reduce((acc, p) => acc + p.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const globalPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const criticalStockCount = products.filter((p) => p.minimum !== null && p.available <= p.minimum).length;
    const activeProjectsCount = projects.filter((p) => p.status === "active").length;
    const pendingReqsCount = requisitions.filter((r) => r.status === "pending").length;

    return { totalBudget, totalSpent, totalRemaining, globalPercent, criticalStockCount, activeProjectsCount, pendingReqsCount };
  }, [projects, projectStats, products, requisitions]);

  // Contextual greeting
  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Buenos días" : greetingHour < 18 ? "Buenas tardes" : "Buenas noches";
  const todayFormatted = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  // Top 5 Materiales más costosos
  const topMaterials = useMemo(() => {
    const spend: Record<string, { name: string; total: number; qty: number; unit: string }> = {};
    movements.filter((m) => m.type === "exit").forEach((m) => {
      const key = m.productId;
      if (!spend[key]) spend[key] = { name: m.productName || "Material", total: 0, qty: 0, unit: m.unit || "und" };
      spend[key].total += m.totalCost;
      spend[key].qty += m.quantity;
    });
    return Object.entries(spend)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [movements]);

  const topMaterialsMaxSpend = topMaterials.length > 0 ? topMaterials[0].total : 1;
  const totalMaterialSpend = topMaterials.reduce((acc, m) => acc + m.total, 0);

  // Artículos críticos bajo mínimo
  const criticalItems = useMemo(() => {
    return products
      .filter((p) => p.minimum !== null && p.available <= (p.minimum ?? 0))
      .map((p) => ({ ...p, deficit: (p.minimum ?? 0) - p.available }))
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 8);
  }, [products]);

  // Activity summary
  const activitySummary = useMemo(() => ({
    totalDispatches: movements.filter((m) => m.type === "exit").length,
    totalEntries: movements.filter((m) => m.type === "entry").length,
    activeTools: toolLoans.filter((t) => t.status === "active").length,
  }), [movements, toolLoans]);

  // Modales
  const [activeModal, setActiveModal] = useState<"dispatch" | "project" | "requisition" | "return" | "tool" | null>(null);
  const [selectedVoucherMovement, setSelectedVoucherMovement] = useState<InventoryMovement | null>(null);

  // Form States
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || "");
  const [quantityInput, setQuantityInput] = useState("");
  const [responsibleInput, setResponsibleInput] = useState("Maestro de Obra");
  const [notesInput, setNotesInput] = useState("");
  const [workerNameInput, setWorkerNameInput] = useState("");
  const [toolNameInput, setToolNameInput] = useState("Pulidora Angular 7in");

  // Requisición Form
  const [reqProject, setReqProject] = useState(projects[0]?.id || "");
  const [reqRequestedBy, setReqRequestedBy] = useState("Carlos Restrepo (Maestro)");
  const [reqNotes, setReqNotes] = useState("");

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "warning" | "info" }>>([]);
  const showToast = (message: string, type: "success" | "warning" | "info" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const alphabetizedProjects = useMemo(
    () => [...projects].sort((a, b) => spanishCollator.compare(`${a.code} ${a.name}`, `${b.code} ${b.name}`)),
    [projects]
  );

  // Handle New Dispatch (Salida a Obra)
  const handleDispatchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantityInput);
    if (!selectedProduct) return alert("Selecciona un material de la lista antes de continuar.");
    if (!qty || qty <= 0) return alert("Ingrese una cantidad válida.");
    if (qty > selectedProduct.available) return alert(`Stock insuficiente. Solo hay ${selectedProduct.available} unidades.`);

    const prj = projects.find((p) => p.id === selectedProjectId);
    const unitCost = selectedProduct.unitCost || 25000;
    const totalCost = qty * unitCost;

    const newMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: "exit",
      quantity: qty,
      unit: selectedProduct.unit,
      unitCost,
      totalCost,
      occurredAt: formatDateTime(),
      reference: `VALE-2026-${String(movements.length + 1).padStart(3, "0")}`,
      projectId: prj?.id,
      projectName: prj?.name,
      responsible: responsibleInput,
      notes: notesInput,
    };

    setProducts((prev) =>
      prev.map((p) => (p.id === selectedProduct.id ? { ...p, available: p.available - qty } : p))
    );
    setMovements((prev) => [newMovement, ...prev]);

    setSelectedVoucherMovement(newMovement);
    setActiveModal(null);
    setQuantityInput("");
    setNotesInput("");
  };

  // Handle Devolución de Sobrante
  const handleReturnSubmit = (e: FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantityInput);
    if (!selectedProduct) return alert("Selecciona un material de la lista antes de continuar.");
    if (!qty || qty <= 0) return alert("Ingrese una cantidad válida.");

    const prj = projects.find((p) => p.id === selectedProjectId);
    const unitCost = selectedProduct.unitCost || 25000;
    const totalCost = qty * unitCost;

    const newMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: "return",
      quantity: qty,
      unit: selectedProduct.unit,
      unitCost,
      totalCost,
      occurredAt: formatDateTime(),
      reference: `DEV-2026-${String(movements.length + 1).padStart(3, "0")}`,
      projectId: prj?.id,
      projectName: prj?.name,
      responsible: responsibleInput,
      notes: `Devolución sobrante de obra: ${notesInput}`,
    };

    setProducts((prev) =>
      prev.map((p) => (p.id === selectedProduct.id ? { ...p, available: p.available + qty } : p))
    );
    setMovements((prev) => [newMovement, ...prev]);

    setActiveModal(null);
    setQuantityInput("");
    setNotesInput("");
    showToast("Devolución registrada. Se incrementó el stock y se descontó el costo de la obra.", "success");
  };

  // Handle Nueva Requisición
  const handleRequisitionSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return alert("Selecciona un material de la lista antes de continuar.");
    const prj = projects.find((p) => p.id === reqProject);
    const newReq: MaterialRequisition = {
      id: `req-${Date.now()}`,
      code: `REQ-2026-${String(requisitions.length + 1).padStart(3, "0")}`,
      projectId: prj?.id || "prj-01",
      projectName: prj?.name || "Obra General",
      requestedBy: reqRequestedBy,
      status: "pending",
      createdAt: formatDateTime(),
      notes: reqNotes,
      items: [
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity: parseFloat(quantityInput) || 10,
          unit: selectedProduct.unit,
          unitCost: selectedProduct.unitCost || 25000,
        },
      ],
    };

    setRequisitions((prev) => [newReq, ...prev]);
    setActiveModal(null);
    showToast(`Requisición ${newReq.code} enviada al Jefe de Almacén.`, "info");
  };

  // Aprobar y Despachar Requisición
  const handleApproveRequisition = (req: MaterialRequisition) => {
    const item = req.items[0];
    if (!item) return;
    const prod = products.find((p) => p.id === item.productId) || products[0];

    if (item.quantity > prod.available) {
      return alert(`Stock insuficiente para aprobar requisición. Solicitado: ${item.quantity}, Disponible: ${prod.available}`);
    }

    const newMov: InventoryMovement = {
      id: `mov-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      type: "exit",
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      totalCost: item.quantity * item.unitCost,
      occurredAt: formatDateTime(),
      reference: `VALE-${req.code}`,
      projectId: req.projectId,
      projectName: req.projectName,
      responsible: req.requestedBy,
      notes: `Despachado desde Requisición ${req.code}. ${req.notes || ""}`,
    };

    setProducts((prev) => prev.map((p) => (p.id === prod.id ? { ...p, available: p.available - item.quantity } : p)));
    setMovements((prev) => [newMov, ...prev]);
    setRequisitions((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "dispatched" } : r)));

    setSelectedVoucherMovement(newMov);
  };

  // Préstamo de Herramienta
  const handleToolLoanSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!workerNameInput.trim()) return alert("Ingrese el nombre del trabajador.");
    const prj = projects.find((p) => p.id === selectedProjectId);

    const newLoan: ToolLoan = {
      id: `loan-${Date.now()}`,
      code: `PRST-2026-${String(toolLoans.length + 1).padStart(3, "0")}`,
      toolId: `tool-${Date.now()}`,
      toolName: toolNameInput,
      workerName: workerNameInput,
      projectId: prj?.id || "prj-01",
      projectName: prj?.name || "Obra General",
      loanDate: new Date().toISOString().split("T")[0],
      status: "active",
      notes: notesInput,
    };

    setToolLoans((prev) => [newLoan, ...prev]);
    setActiveModal(null);
    setWorkerNameInput("");
    setNotesInput("");
    showToast("Préstamo de herramienta registrado correctamente.", "success");
  };

  // Registrar devolución de herramienta
  const handleReturnToolLoan = (loanId: string) => {
    setToolLoans((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: "returned", actualReturnDate: new Date().toISOString().split("T")[0] } : l))
    );
  };

  return (
    <main className="dashboard-content dashboard-v3" id="main-content" tabIndex={-1}>
      {/* Contextual Greeting & Activity Summary */}
      <section className="dashboard-heading greeting-section">
        <div>
          <p className="greeting-date">{todayFormatted}</p>
          <h1>{greeting}, Jaime</h1>
          <div className="greeting-activity">
            <span className="activity-pill pill-dispatches">📤 {activitySummary.totalDispatches} despachos</span>
            <span className="activity-pill pill-entries">📥 {activitySummary.totalEntries} entradas</span>
            <span className="activity-pill pill-reqs">{globalFinancials.pendingReqsCount > 0 ? `🟡 ${globalFinancials.pendingReqsCount} requisiciones pendientes` : "✅ Sin requisiciones pendientes"}</span>
            {activitySummary.activeTools > 0 && <span className="activity-pill pill-tools">🛠️ {activitySummary.activeTools} herramientas en obra</span>}
          </div>
        </div>
        <div className="dash-quick-btns">
          <button className="inventory-action btn-primary-action" onClick={() => setActiveModal("dispatch")}>
            📤 Nuevo Vale de Salida
          </button>
          <button className="inventory-action btn-secondary-action" onClick={() => setActiveModal("requisition")}>
            📝 Solicitud de Obra
          </button>
        </div>
      </section>

      {/* KPI Financial Cards */}
      <section className="dashboard-stat-grid exec-stat-grid" aria-label="Indicadores financieros consolidados">
        <article className="stat-card">
          <span>Presupuesto Obras ($ COP)</span>
          <strong>{currencyFormatter.format(globalFinancials.totalBudget)}</strong>
          <small>{globalFinancials.activeProjectsCount} obras activas contratadas</small>
        </article>

        <article className="stat-card card-spent">
          <span>Gasto Real Materiales</span>
          <strong className="text-spent">{currencyFormatter.format(globalFinancials.totalSpent)}</strong>
          <small>{globalFinancials.globalPercent}% del presupuesto total despachado</small>
        </article>

        <article className="stat-card card-remaining">
          <span>Saldo Disponible Obras</span>
          <strong className="text-remaining">{currencyFormatter.format(globalFinancials.totalRemaining)}</strong>
          <small>Fondo para consumo de materiales</small>
        </article>

        <article className="stat-card card-alerts">
          <span>Alertas de Operación</span>
          <strong>{globalFinancials.criticalStockCount + globalFinancials.pendingReqsCount}</strong>
          <small>
            {globalFinancials.criticalStockCount} ítems bajo mínimo · {globalFinancials.pendingReqsCount} requisiciones pendientes
          </small>
        </article>
      </section>

      {/* Action Toolbar */}
      <section className="dashboard-toolbar-bar">
        <span>Acciones Rápidas de Operaciones:</span>
        <div className="toolbar-buttons">
          <button className="tb-btn" onClick={() => setActiveModal("dispatch")}>
            📤 Despachar a Obra
          </button>
          <button className="tb-btn" onClick={() => setActiveModal("return")}>
            ↩️ Devolución de Sobrante
          </button>
          <button className="tb-btn" onClick={() => setActiveModal("requisition")}>
            📝 Requisición de Material
          </button>
          <button className="tb-btn" onClick={() => setActiveModal("tool")}>
            🛠️ Préstamo de Herramienta
          </button>
          <Link href="/inventory" className="tb-btn btn-link-inv">
            📦 Abrir Catálogo Completo (1,191 insumos) →
          </Link>
        </div>
      </section>

      {/* MAIN CENTERPIECE: Active Projects & Material Costing */}
      <section className="exec-projects-section">
        <div className="section-title">
          <div>
            <p>Control Financiero por Frente de Trabajo</p>
            <h2>Centro de Costos de Materiales por Obra / Proyecto</h2>
          </div>
          <span className="dashboard-data-badge">Valorización en Vivo ($ COP)</span>
        </div>

        <div className="projects-grid">
          {projectStats.map((prj) => (
            <article className={`project-card status-${prj.statusColor}`} key={prj.id}>
              <div className="prj-card-header">
                <div>
                  <span className="prj-code">{prj.code}</span>
                  <h3>{prj.name}</h3>
                  <small>Cliente: {prj.client} · {prj.location}</small>
                </div>
                <span className={`prj-badge badge-${prj.statusColor}`}>
                  {prj.progressPercent >= 100 ? "🔴 Sobrecosto" : prj.progressPercent >= 80 ? "🟡 Alerta Stock" : "🟢 Normal"}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="prj-progress-box">
                <div className="prj-progress-labels">
                  <span>Avance Presupuestal</span>
                  <strong>{prj.progressPercent}% Ejecutado</strong>
                </div>
                <div className="prj-bar-track">
                  <div className={`prj-bar-fill fill-${prj.statusColor}`} style={{ width: `${prj.progressPercent}%` }} />
                </div>
              </div>

              {/* Financial Metrics */}
              <div className="prj-financial-rows">
                <div className="fin-row">
                  <span>Presupuesto Materiales:</span>
                  <strong>{currencyFormatter.format(prj.budget)}</strong>
                </div>
                <div className="fin-row spent-row">
                  <span>Gasto Acumulado Real:</span>
                  <strong>{currencyFormatter.format(prj.spent)}</strong>
                </div>
                <div className="fin-row remaining-row">
                  <span>Saldo Disponible:</span>
                  <strong className={prj.remaining < 0 ? "text-danger" : "text-success"}>
                    {currencyFormatter.format(prj.remaining)}
                  </strong>
                </div>
              </div>

              {/* Recent Materials */}
              {prj.recentMovements.length > 0 && (
                <div className="prj-recent-items">
                  <small className="recent-title">Últimos insumos despachados:</small>
                  <ul>
                    {prj.recentMovements.map((m) => (
                      <li key={m.id}>
                        <span>{m.productName} ({m.quantity} {m.unit})</span>
                        <small>{currencyFormatter.format(m.totalCost)}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="prj-card-footer">
                <button
                  className="btn-card-dispatch"
                  onClick={() => {
                    setSelectedProjectId(prj.id);
                    setActiveModal("dispatch");
                  }}
                >
                  📤 Despachar Material a esta Obra
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Intelligence Panels: Top Materials + Spending Chart */}
      <section className="dashboard-intel-grid">
        <article className="dashboard-panel">
          <div className="panel-title">
            <div>
              <p>Inteligencia de Costos</p>
              <h2>Top 5 Materiales Más Costosos</h2>
            </div>
          </div>
          {topMaterials.length === 0 ? (
            <p className="panel-intro">Registre despachos para ver el ranking de costos de materiales.</p>
          ) : (
            <div className="top-materials-list">
              {topMaterials.map((mat, idx) => (
                <div className="top-mat-row" key={mat.id}>
                  <span className="top-rank">#{idx + 1}</span>
                  <div className="top-mat-info">
                    <strong>{mat.name}</strong>
                    <small>{numberFormatter.format(mat.qty)} {mat.unit} despachados</small>
                  </div>
                  <div className="top-mat-cost">
                    <strong>{currencyFormatter.format(mat.total)}</strong>
                    <small>{totalMaterialSpend > 0 ? Math.round((mat.total / totalMaterialSpend) * 100) : 0}% del gasto</small>
                  </div>
                  <div className="top-mat-bar-track">
                    <div className="top-mat-bar-fill" style={{ width: `${(mat.total / topMaterialsMaxSpend) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-panel">
          <div className="panel-title">
            <div>
              <p>Comparativo</p>
              <h2>Gasto Acumulado por Obra</h2>
            </div>
          </div>
          <div className="spending-chart">
            {projectStats.map((prj) => {
              const maxSpent = Math.max(...projectStats.map((p) => p.spent), 1);
              return (
                <div className="chart-bar-row" key={prj.id}>
                  <div className="chart-label">
                    <strong>{prj.code}</strong>
                    <small>{prj.name}</small>
                  </div>
                  <div className="chart-bar-track">
                    <div className={`chart-bar-fill fill-${prj.statusColor}`} style={{ width: `${(prj.spent / maxSpent) * 100}%` }} />
                  </div>
                  <span className="chart-value">{currencyFormatter.format(prj.spent)}</span>
                </div>
              );
            })}
          </div>
          <div className="chart-legend">
            <span className="legend-item"><i className="legend-dot dot-green" /> Normal (&lt;80%)</span>
            <span className="legend-item"><i className="legend-dot dot-yellow" /> Alerta (80-100%)</span>
            <span className="legend-item"><i className="legend-dot dot-red" /> Sobrecosto (&gt;100%)</span>
          </div>
        </article>
      </section>

      {/* Critical Stock Items */}
      {criticalItems.length > 0 && (
        <section className="dashboard-panel critical-stock-panel">
          <div className="panel-title">
            <div>
              <p>Alerta de Almacén</p>
              <h2>⚠️ Artículos Críticos por Debajo del Mínimo</h2>
            </div>
            <span className="critical-badge">{criticalItems.length} artículos requieren compra</span>
          </div>
          <table className="critical-table">
            <thead>
              <tr>
                <th>Material / Insumo</th>
                <th>Grupo</th>
                <th>Stock Actual</th>
                <th>Mínimo Req.</th>
                <th>Déficit</th>
                <th>Acción Sugerida</th>
              </tr>
            </thead>
            <tbody>
              {criticalItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.category} · {item.brand}</small>
                  </td>
                  <td>{item.inventoryGroupName}</td>
                  <td>
                    <strong className={item.available <= 0 ? "text-danger" : "text-warning"}>
                      {item.available} {item.unit}
                    </strong>
                  </td>
                  <td>{item.minimum} {item.unit}</td>
                  <td><strong className="text-danger">{item.deficit} {item.unit}</strong></td>
                  <td><span className="action-tag">Comprar {item.deficit} {item.unit}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Operational Grid: Requisitions & Tool Custody */}
      <section className="dashboard-analytics-grid exec-sub-grid">
        {/* Requisiciones de Frente de Obra */}
        <article className="dashboard-panel">
          <div className="panel-title">
            <div>
              <p>Frentes de Obra</p>
              <h2>Requisiciones de Material Pendientes</h2>
            </div>
            <span className="req-count-badge">{globalFinancials.pendingReqsCount} Pendientes</span>
          </div>
          <p className="panel-intro">Solicitudes de insumos enviadas por los maestros o residentes de obra pendientes de despacho.</p>

          <div className="requisitions-list">
            {requisitions.length === 0 ? (
              <p className="empty-text">No hay requisiciones registradas.</p>
            ) : (
              requisitions.map((req) => (
                <div className={`req-item status-${req.status}`} key={req.id}>
                  <div className="req-info">
                    <div className="req-header">
                      <strong>{req.code} · {req.projectName}</strong>
                      <span className={`status-pill pill-${req.status}`}>
                        {req.status === "pending" ? "🟡 Pendiente" : req.status === "dispatched" ? "🟢 Despachado" : req.status}
                      </span>
                    </div>
                    <small>Solicitado por: {req.requestedBy} · Fecha: {req.createdAt}</small>
                    <div className="req-products">
                      {req.items.map((it, idx) => (
                        <span key={idx}>
                          • {it.productName}: <strong>{it.quantity} {it.unit}</strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <button className="btn-approve-req" onClick={() => handleApproveRequisition(req)}>
                      ⚡ Aprobar y Despachar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </article>

        {/* Custodia y Préstamo de Herramientas */}
        <article className="dashboard-panel">
          <div className="panel-title">
            <div>
              <p>Control de Custodia</p>
              <h2>Herramientas en Préstamo</h2>
            </div>
            <button className="btn-mini-add" onClick={() => setActiveModal("tool")}>
              + Prestar Herramienta
            </button>
          </div>
          <p className="panel-intro">Seguimiento a equipos mayores y herramientas entregadas a cuadrillas y trabajadores.</p>

          <div className="tool-loans-list">
            {toolLoans.map((loan) => (
              <div className={`loan-item status-${loan.status}`} key={loan.id}>
                <div>
                  <strong>🛠️ {loan.toolName}</strong>
                  <small>Entregado a: <b>{loan.workerName}</b> ({loan.projectName})</small>
                  <span className="loan-date">Fecha salida: {loan.loanDate}</span>
                </div>
                {loan.status === "active" ? (
                  <button className="btn-return-tool" onClick={() => handleReturnToolLoan(loan.id)}>
                    ↩️ Devolver
                  </button>
                ) : (
                  <span className="badge-returned">✓ Devuelto</span>
                )}
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Movement Kardex Log with Printable Voucher Action */}
      <section className="dashboard-panel kardex-section">
        <div className="panel-title">
          <div>
            <p>Trazabilidad Completa</p>
            <h2>Kardex de Movimientos Recientes</h2>
          </div>
          <Link href="/inventory" className="panel-link">
            Ver Kardex Completo (822 movimientos) →
          </Link>
        </div>

        <table className="kardex-table">
          <thead>
            <tr>
              <th>Fecha / Folio</th>
              <th>Tipo</th>
              <th>Producto / Material</th>
              <th>Cantidad</th>
              <th>Costo Unit.</th>
              <th>Total ($ COP)</th>
              <th>Obra / Destino</th>
              <th>Acción Remisión</th>
            </tr>
          </thead>
          <tbody>
            {movements.slice(0, 5).map((mov) => (
              <tr key={mov.id}>
                <td>
                  <strong>{mov.reference}</strong>
                  <small>{mov.occurredAt}</small>
                </td>
                <td>
                  <span className={`mov-badge mov-${mov.type}`}>
                    {mov.type === "exit" ? "Salida Obra" : mov.type === "entry" ? "Entrada Bodega" : mov.type === "return" ? "Devolución" : "Ajuste"}
                  </span>
                </td>
                <td>
                  <strong>{mov.productName}</strong>
                  {mov.responsible && <small>Resp: {mov.responsible}</small>}
                </td>
                <td>{mov.quantity} {mov.unit}</td>
                <td>{currencyFormatter.format(mov.unitCost)}</td>
                <td><strong>{currencyFormatter.format(mov.totalCost)}</strong></td>
                <td>{mov.projectName || "Almacén Central"}</td>
                <td>
                  <button
                    className="btn-view-voucher"
                    onClick={() => setSelectedVoucherMovement(mov)}
                  >
                    📄 Ver Remisión
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* MODAL 1: Despacho a Obra (Salida) */}
      {activeModal === "dispatch" && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2>📤 Registrar Salida de Material a Obra</h2>
              <button onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleDispatchSubmit}>
              <div className="form-group">
                <label>Seleccionar Material / Insumo:</label>
                <SearchableProductPicker
                  products={products}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  formatDetail={(product) => `${product.sku} · ${currencyFormatter.format(product.unitCost || 25000)}`}
                />
              </div>

              <div className="form-group">
                <label>Obra Destino (Imputación de Costo):</label>
                <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                  {alphabetizedProjects.map((prj) => (
                    <option key={prj.id} value={prj.id}>
                      {prj.code} - {prj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Cantidad a Despachar:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={`Máx: ${selectedProduct?.available || 0}`}
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Responsable en Obra:</label>
                  <input
                    type="text"
                    required
                    value={responsibleInput}
                    onChange={(e) => setResponsibleInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notas / Observaciones:</label>
                <input
                  type="text"
                  placeholder="ej. Fundición de columnas bloque 2"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
              </div>

              {quantityInput && parseFloat(quantityInput) > 0 && (
                <div className="calc-preview-box">
                  <span>Total Costo Estimado Despacho:</span>
                  <strong>
                    {currencyFormatter.format((parseFloat(quantityInput) || 0) * (selectedProduct?.unitCost || 25000))}
                  </strong>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Confirmar Despacho e Imprimir Remisión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Devolución de Sobrante */}
      {activeModal === "return" && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2>↩️ Registrar Devolución de Material Sobrante</h2>
              <button onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleReturnSubmit}>
              <div className="form-group">
                <label>Obra de Origen (Reversión de Costo):</label>
                <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                  {alphabetizedProjects.map((prj) => (
                    <option key={prj.id} value={prj.id}>
                      {prj.code} - {prj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Material Devuelto a Bodega:</label>
                <SearchableProductPicker products={products} value={selectedProductId} onChange={setSelectedProductId} />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Cantidad Devuelta:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Cantidad devuelta"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Responsable Entrega:</label>
                  <input
                    type="text"
                    required
                    value={responsibleInput}
                    onChange={(e) => setResponsibleInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Reintegrar a Bodega y Descontar de Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Nueva Requisición */}
      {activeModal === "requisition" && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2>📝 Nueva Solicitud de Material desde Obra</h2>
              <button onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleRequisitionSubmit}>
              <div className="form-group">
                <label>Obra / Frente de Trabajo:</label>
                <select value={reqProject} onChange={(e) => setReqProject(e.target.value)}>
                  {alphabetizedProjects.map((prj) => (
                    <option key={prj.id} value={prj.id}>
                      {prj.code} - {prj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Insumo Requerido:</label>
                <SearchableProductPicker products={products} value={selectedProductId} onChange={setSelectedProductId} />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Cantidad Necesaria:</label>
                  <input
                    type="number"
                    required
                    placeholder="Cantidad"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Solicitado por (Residente/Maestro):</label>
                  <input
                    type="text"
                    required
                    value={reqRequestedBy}
                    onChange={(e) => setReqRequestedBy(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Justificación / Ubicación en Obra:</label>
                <input
                  type="text"
                  placeholder="ej. Fundición de placas segundo nivel"
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Enviar Requisición a Almacén
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Préstamo de Herramienta */}
      {activeModal === "tool" && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2>🛠️ Registrar Préstamo de Herramienta</h2>
              <button onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleToolLoanSubmit}>
              <div className="form-group">
                <label>Herramienta / Equipo a Entregar:</label>
                <input
                  type="text"
                  required
                  value={toolNameInput}
                  onChange={(e) => setToolNameInput(e.target.value)}
                  placeholder="ej. Pulidora DeWalt 7in, Soldador Inverter..."
                />
              </div>

              <div className="form-group">
                <label>Trabajador Responsable:</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Pedro Ramírez (Soldador)"
                  value={workerNameInput}
                  onChange={(e) => setWorkerNameInput(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Obra Asignada:</label>
                <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                  {alphabetizedProjects.map((prj) => (
                    <option key={prj.id} value={prj.id}>
                      {prj.code} - {prj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Confirmar Préstamo de Herramienta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VOUCHER IMPRIMIBLE */}
      <PrintableDispatchVoucher
        movement={selectedVoucherMovement}
        project={projects.find((p) => p.id === selectedVoucherMovement?.projectId)}
        onClose={() => setSelectedVoucherMovement(null)}
      />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item toast-${t.type}`}>
              <span className="toast-icon">{t.type === "success" ? "✅" : t.type === "warning" ? "⚠️" : "ℹ️"}</span>
              <p>{t.message}</p>
              <button className="toast-dismiss" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} type="button" aria-label="Cerrar">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
