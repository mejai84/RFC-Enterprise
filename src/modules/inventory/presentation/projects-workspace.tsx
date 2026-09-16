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

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatDateTime() {
  const date = new Date();
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ProjectsWorkspace() {
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

  // Selected Project State
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || "prj-01");
  const [activeTab, setActiveTab] = useState<"materials" | "tools" | "requisitions">("materials");
  const [projectStatusFilter, setProjectStatusFilter] = useState<"all" | Project["status"]>("all");

  // Modals
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [isBudgetAdjustmentOpen, setIsBudgetAdjustmentOpen] = useState(false);
  const [selectedVoucherMovement, setSelectedVoucherMovement] = useState<InventoryMovement | null>(null);

  // Dispatch Form State
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [quantityInput, setQuantityInput] = useState("");
  const [responsibleInput, setResponsibleInput] = useState("Maestro de Obra");
  const [notesInput, setNotesInput] = useState("");

  // New Project Form State
  const [newPrjCode, setNewPrjCode] = useState("");
  const [newPrjName, setNewPrjName] = useState("");
  const [newPrjClient, setNewPrjClient] = useState("");
  const [newPrjLocation, setNewPrjLocation] = useState("");
  const [newPrjBudget, setNewPrjBudget] = useState("");
  const [newPrjStartDate, setNewPrjStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newPrjEstimatedEndDate, setNewPrjEstimatedEndDate] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEstimatedEndDate, setEditEstimatedEndDate] = useState("");
  const [editStatus, setEditStatus] = useState<Project["status"]>("active");
  const [budgetAdjustment, setBudgetAdjustment] = useState("");
  const [budgetReason, setBudgetReason] = useState("");

  // Persistir cambios
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rfc_inventory_products", JSON.stringify(products));
      localStorage.setItem("rfc_inventory_movements", JSON.stringify(movements));
      localStorage.setItem("rfc_inventory_projects", JSON.stringify(projects));
      localStorage.setItem("rfc_inventory_requisitions", JSON.stringify(requisitions));
      localStorage.setItem("rfc_inventory_tool_loans", JSON.stringify(toolLoans));
    }
  }, [products, movements, projects, requisitions, toolLoans]);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0];
  }, [projects, selectedProjectId]);
  const visibleProjects = useMemo(() => projectStatusFilter === "all" ? projects : projects.filter((project) => project.status === projectStatusFilter), [projects, projectStatusFilter]);

  // Project Specific Computations
  const projectMovements = useMemo(() => {
    return movements.filter((m) => m.projectId === selectedProject?.id);
  }, [movements, selectedProject]);

  const projectSpent = useMemo(() => {
    return projectMovements.reduce((acc, m) => {
      if (m.type === "exit") return acc + m.totalCost;
      if (m.type === "return") return acc - m.totalCost;
      return acc;
    }, 0);
  }, [projectMovements]);

  const projectRemaining = (selectedProject?.budget || 0) - projectSpent;
  const projectProgress = selectedProject?.budget ? Math.min(Math.round((projectSpent / selectedProject.budget) * 100), 100) : 0;
  const projectSignal = selectedProject?.status === "completed" ? "red" : selectedProject?.status === "on_hold" ? "yellow" : projectProgress >= 100 ? "red" : projectProgress >= 80 ? "yellow" : "green";
  const projectSignalLabel = selectedProject?.status === "completed" ? "Finalizada" : selectedProject?.status === "on_hold" ? "En pausa" : projectProgress >= 100 ? "Sobrecosto" : projectProgress >= 80 ? "Alerta de presupuesto" : "Activa";

  const projectTools = useMemo(() => {
    return toolLoans.filter((t) => t.projectId === selectedProject?.id);
  }, [toolLoans, selectedProject]);

  const projectRequisitions = useMemo(() => {
    return requisitions.filter((r) => r.projectId === selectedProject?.id);
  }, [requisitions, selectedProject]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  // Handle Dispatch Form Submit
  const handleDispatchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantityInput);
    if (!qty || qty <= 0) return alert("Ingrese una cantidad válida.");
    if (qty > selectedProduct.available) return alert(`Stock insuficiente. Disponible: ${selectedProduct.available}`);

    const unitCost = selectedProduct.unitCost || 25000;
    const totalCost = qty * unitCost;

    const newMov: InventoryMovement = {
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
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      responsible: responsibleInput,
      notes: notesInput,
    };

    setProducts((prev) => prev.map((p) => (p.id === selectedProduct.id ? { ...p, available: p.available - qty } : p)));
    setMovements((prev) => [newMov, ...prev]);

    setSelectedVoucherMovement(newMov);
    setIsDispatchModalOpen(false);
    setQuantityInput("");
    setNotesInput("");
  };

  // Handle New Project Form Submit
  const handleNewProjectSubmit = (e: FormEvent) => {
    e.preventDefault();
    const budgetNum = parseFloat(newPrjBudget);
    if (!newPrjName.trim() || !newPrjClient.trim() || !budgetNum || !newPrjStartDate || !newPrjEstimatedEndDate) return alert("Complete todos los campos obligatorios.");
    if (newPrjEstimatedEndDate < newPrjStartDate) return alert("La fecha estimada debe ser posterior a la fecha de inicio.");

    const newPrj: Project = {
      id: `prj-${Date.now()}`,
      code: newPrjCode || `OBRA-2026-${String(projects.length + 1).padStart(2, "0")}`,
      name: newPrjName,
      client: newPrjClient,
      location: newPrjLocation || "Antioquia",
      budget: budgetNum,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0],
      startDate: newPrjStartDate,
      estimatedEndDate: newPrjEstimatedEndDate,
    };

    setProjects((prev) => [...prev, newPrj]);
    setSelectedProjectId(newPrj.id);
    setIsNewProjectModalOpen(false);
    setNewPrjCode("");
    setNewPrjName("");
    setNewPrjClient("");
    setNewPrjLocation("");
    setNewPrjBudget("");
    setNewPrjEstimatedEndDate("");
  };

  const openEditProject = (project: Project) => {
    setSelectedProjectId(project.id);
    setEditStartDate(project.startDate || "");
    setEditEstimatedEndDate(project.estimatedEndDate || "");
    setEditStatus(project.status);
    setIsProjectPickerOpen(false);
    setIsEditProjectModalOpen(true);
  };

  const handleEditProjectSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !editStartDate || !editEstimatedEndDate) return alert("Indique ambas fechas.");
    if (editEstimatedEndDate < editStartDate) return alert("La fecha estimada debe ser posterior a la fecha de inicio.");
    setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, startDate: editStartDate, estimatedEndDate: editEstimatedEndDate, status: editStatus } : project));
    setIsEditProjectModalOpen(false);
  };

  const handleBudgetAdjustment = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(budgetAdjustment);
    if (!selectedProject || !amount || !budgetReason.trim()) return alert("Indique el valor y el motivo del ajuste.");
    if (selectedProject.budget + amount < projectSpent) return alert("El nuevo presupuesto no puede ser menor al gasto acumulado.");
    setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, budget: project.budget + amount } : project));
    setBudgetAdjustment(""); setBudgetReason(""); setIsBudgetAdjustmentOpen(false);
  };

  return (
    <main className="dashboard-content dashboard-v3" id="main-content" tabIndex={-1}>
      {/* Header */}
      <section className="dashboard-heading">
        <div>
          <p>Módulo de Obras & Frente de Trabajo</p>
          <h1>Centro de Costos de Proyectos</h1>
          <small>Consulta detallada del consumo de materiales, insumos gastados y herramientas en custodia por obra.</small>
        </div>
        <div className="dash-quick-btns">
          <button className="inventory-action btn-edit-project" onClick={() => setIsProjectPickerOpen(true)}>
            Editar proyecto
          </button>
          <button className="inventory-action btn-budget-adjustment" onClick={() => setIsBudgetAdjustmentOpen(true)}>Ajustar presupuesto</button>
          <button className="inventory-action btn-primary-action" onClick={() => setIsDispatchModalOpen(true)}>
            📤 Despachar a esta Obra
          </button>
          <button className="inventory-action btn-new-project" onClick={() => setIsNewProjectModalOpen(true)}>
            ➕ Nueva Obra / Proyecto
          </button>
        </div>
      </section>

      {/* Projects Navigation Selector */}
      <section className="projects-selector-bar">
        <span className="selector-label">Seleccionar Obra:</span>
        <label className="project-status-filter">Estado <select value={projectStatusFilter} onChange={(event) => setProjectStatusFilter(event.target.value as "all" | Project["status"])}><option value="all">Todas</option><option value="pending">Pendientes</option><option value="active">Activas</option><option value="on_hold">En pausa</option><option value="completed">Finalizadas</option></select></label>
        <div className="selector-pills">
          {visibleProjects.map((prj) => (
            <button
              key={prj.id}
              className={`prj-pill status-${prj.status} ${prj.id === selectedProjectId ? "is-selected" : ""}`}
              onClick={() => setSelectedProjectId(prj.id)}
            >
              <span className="pill-code">{prj.code}</span>
              <strong className="pill-name">{prj.name}</strong>
            </button>
          ))}
          {visibleProjects.length === 0 && <p className="project-filter-empty">No hay obras con este estado.</p>}
        </div>
      </section>

      {/* Selected Project Full Ficha */}
      {selectedProject && (
        <section className="project-detail-container">
          {/* Main Ficha Card */}
          <div className="project-main-card">
            <div className="card-top-info">
              <div>
                <span className="prj-code-badge">{selectedProject.code}</span>
                <h2>{selectedProject.name}</h2>
                <p>Cliente: <strong>{selectedProject.client}</strong> · Ubicación: <strong>{selectedProject.location}</strong></p>
              </div>
              <span className={`status-badge-lg status-${projectSignal}`}>
                {projectSignalLabel}
              </span>
            </div>

            {/* Financial Metrics Summary */}
            <div className="project-metrics-grid">
              <div className="metric-box">
                <span>Presupuesto Materiales:</span>
                <strong>{currencyFormatter.format(selectedProject.budget)}</strong>
              </div>
              <div className="metric-box spent">
                <span>Gasto Real Acumulado:</span>
                <strong className="text-danger">{currencyFormatter.format(projectSpent)}</strong>
              </div>
              <div className="metric-box remaining">
                <span>Saldo Disponible:</span>
                <strong className={projectRemaining < 0 ? "text-danger" : "text-success"}>
                  {currencyFormatter.format(projectRemaining)}
                </strong>
              </div>
              <div className="metric-box progress">
                <span>Ejecución Presupuestal:</span>
                <strong>{projectProgress}%</strong>
                <div className="metric-bar-track">
                  <div
                    className={`metric-bar-fill fill-${projectProgress >= 100 ? "red" : projectProgress >= 80 ? "yellow" : "green"}`}
                    style={{ width: `${projectProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Tab Navigation */}
          <div className="project-tabs-header">
            <button
              className={`tab-btn ${activeTab === "materials" ? "is-active" : ""}`}
              onClick={() => setActiveTab("materials")}
            >
              📦 Materiales e Insumos Gastados ({projectMovements.length})
            </button>
            <button
              className={`tab-btn ${activeTab === "tools" ? "is-active" : ""}`}
              onClick={() => setActiveTab("tools")}
            >
              🛠️ Herramientas en Custodia ({projectTools.length})
            </button>
            <button
              className={`tab-btn ${activeTab === "requisitions" ? "is-active" : ""}`}
              onClick={() => setActiveTab("requisitions")}
            >
              📝 Requisiciones ({projectRequisitions.length})
            </button>
          </div>

          {/* TAB 1: Materiales e Insumos Gastados */}
          {activeTab === "materials" && (
            <div className="project-tab-content">
              <div className="tab-actions-bar">
                <h3>Historial Valorizado de Insumos Despachados a esta Obra</h3>
                <button className="btn-mini-dispatch" onClick={() => setIsDispatchModalOpen(true)}>
                  + Despachar Insumos
                </button>
              </div>

              {projectMovements.length === 0 ? (
                <div className="empty-state-box">
                  <p>Aún no se han registrado despachos de material para esta obra.</p>
                  <button className="btn-submit" onClick={() => setIsDispatchModalOpen(true)}>
                    Registrar Primer Despacho
                  </button>
                </div>
              ) : (
                <table className="materials-table">
                  <thead>
                    <tr>
                      <th>Folio / Fecha</th>
                      <th>Material / Insumo</th>
                      <th>Cantidad Despachada</th>
                      <th>Costo Unit. ($)</th>
                      <th>Total Insumo ($ COP)</th>
                      <th>Recibido por (Obra)</th>
                      <th>Remisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectMovements.map((mov) => (
                      <tr key={mov.id}>
                        <td>
                          <strong>{mov.reference}</strong>
                          <small>{mov.occurredAt}</small>
                        </td>
                        <td>
                          <strong>{mov.productName}</strong>
                          {mov.notes && <div className="table-note">Nota: {mov.notes}</div>}
                        </td>
                        <td>
                          <strong>{mov.quantity} {mov.unit}</strong>
                        </td>
                        <td>{currencyFormatter.format(mov.unitCost)}</td>
                        <td>
                          <strong className={mov.type === "return" ? "text-success" : "text-danger"}>
                            {mov.type === "return" ? "-" : ""}{currencyFormatter.format(mov.totalCost)}
                          </strong>
                        </td>
                        <td>{mov.responsible || "Residente de Obra"}</td>
                        <td>
                          <button
                            className="btn-view-voucher"
                            onClick={() => setSelectedVoucherMovement(mov)}
                          >
                            📄 Remisión Imprimible
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right">
                        <strong>TOTAL ACUMULADO GASTADO EN ESTA OBRA:</strong>
                      </td>
                      <td className="total-spent-cell">
                        <strong>{currencyFormatter.format(projectSpent)}</strong>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: Herramientas en Custodia */}
          {activeTab === "tools" && (
            <div className="project-tab-content">
              <h3>Herramientas y Equipos en Custodia en este Frente de Obra</h3>
              {projectTools.length === 0 ? (
                <div className="empty-state-box">
                  <p>No hay herramientas asignadas en custodia a esta obra.</p>
                </div>
              ) : (
                <div className="tools-grid-view">
                  {projectTools.map((t) => (
                    <div className={`tool-card status-${t.status}`} key={t.id}>
                      <div className="tool-card-icon">🛠️</div>
                      <div>
                        <strong>{t.toolName}</strong>
                        <p>Trabajador a cargo: <strong>{t.workerName}</strong></p>
                        <small>Fecha entrega: {t.loanDate} · Estado: {t.status === "active" ? "En Custodia" : "Devuelto"}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Requisiciones */}
          {activeTab === "requisitions" && (
            <div className="project-tab-content">
              <h3>Solicitudes de Material Enviadas desde esta Obra</h3>
              {projectRequisitions.length === 0 ? (
                <div className="empty-state-box">
                  <p>No hay requisiciones registradas para esta obra.</p>
                </div>
              ) : (
                <div className="requisitions-grid-view">
                  {projectRequisitions.map((req) => (
                    <div className="req-card" key={req.id}>
                      <div className="req-card-header">
                        <strong>{req.code}</strong>
                        <span className={`status-pill pill-${req.status}`}>{req.status}</span>
                      </div>
                      <small>Solicitado por: {req.requestedBy} ({req.createdAt})</small>
                      <ul>
                        {req.items.map((it, idx) => (
                          <li key={idx}>
                            • {it.productName}: <strong>{it.quantity} {it.unit}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* MODAL: Despachar a esta Obra */}
      {isDispatchModalOpen && selectedProject && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2>📤 Despachar Insumos a: {selectedProject.name}</h2>
              <button onClick={() => setIsDispatchModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleDispatchSubmit}>
              <div className="form-group">
                <label>Seleccionar Material / Insumo:</label>
                <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Disp: {p.available} {p.unit}) - {currencyFormatter.format(p.unitCost || 25000)}
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
                  <label>Responsable que Recibe en Obra:</label>
                  <input
                    type="text"
                    required
                    value={responsibleInput}
                    onChange={(e) => setResponsibleInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group"><label>Fecha de inicio:</label><input type="date" required value={newPrjStartDate} onChange={(e) => setNewPrjStartDate(e.target.value)} /></div>
                <div className="form-group"><label>Fecha estimada de finalizaciÃ³n:</label><input type="date" required min={newPrjStartDate} value={newPrjEstimatedEndDate} onChange={(e) => setNewPrjEstimatedEndDate(e.target.value)} /></div>
              </div>

              <div className="form-group">
                <label>Notas / Ubicación de uso:</label>
                <input
                  type="text"
                  placeholder="ej. Aplicación en columnas principales"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsDispatchModalOpen(false)}>
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

      {isEditProjectModalOpen && selectedProject && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
          <div className="modal-content"><div className="modal-header"><h2 id="edit-project-title">Editar proyecto</h2><button type="button" aria-label="Cerrar" onClick={() => setIsEditProjectModalOpen(false)}>×</button></div>
            <form onSubmit={handleEditProjectSubmit}><div className="form-row-2"><div className="form-group"><label>Fecha de inicio:</label><input type="date" required value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} /></div><div className="form-group"><label>Fecha estimada de finalizaciÃ³n:</label><input type="date" required min={editStartDate} value={editEstimatedEndDate} onChange={(e) => setEditEstimatedEndDate(e.target.value)} /></div></div><div className="form-group"><label>Estado:</label><select value={editStatus} onChange={(e) => setEditStatus(e.target.value as Project["status"])}><option value="pending">Pendiente</option><option value="active">Activa</option><option value="on_hold">En pausa</option><option value="completed">Finalizada</option></select></div><div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setIsEditProjectModalOpen(false)}>Cancelar</button><button type="submit" className="btn-submit">Guardar cambios</button></div></form>
          </div>
        </div>
      )}

      {isProjectPickerOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="project-picker-title">
          <div className="modal-content project-picker-modal">
            <div className="modal-header"><h2 id="project-picker-title">Seleccionar proyecto para editar</h2><button type="button" aria-label="Cerrar" onClick={() => setIsProjectPickerOpen(false)}>×</button></div>
            <p className="project-picker-hint">Elige una obra para actualizar sus fechas, estado o información general.</p>
            <div className="project-picker-grid">
              {projects.map((project) => <button key={project.id} type="button" className="project-picker-card" onClick={() => openEditProject(project)}><span>{project.code}</span><strong>{project.name}</strong><small>{project.client}</small></button>)}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Crear Nueva Obra */}
      {isNewProjectModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h2>➕ Dar de Alta Nueva Obra / Proyecto</h2>
              <button onClick={() => setIsNewProjectModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleNewProjectSubmit}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Código Obra:</label>
                  <input
                    type="text"
                    placeholder="ej. OBRA-2026-05"
                    value={newPrjCode}
                    onChange={(e) => setNewPrjCode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Presupuesto de Materiales ($ COP):</label>
                  <input
                    type="number"
                    required
                    placeholder="ej. 25000000"
                    value={newPrjBudget}
                    onChange={(e) => setNewPrjBudget(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nombre de la Obra / Proyecto:</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Adecuación de Red Eléctrica Industrial"
                  value={newPrjName}
                  onChange={(e) => setNewPrjName(e.target.value)}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Cliente Contratante:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Empresa de Minas S.A.S."
                    value={newPrjClient}
                    onChange={(e) => setNewPrjClient(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Ubicación / Municipio:</label>
                  <input
                    type="text"
                    placeholder="ej. Caucasia, Antioquia"
                    value={newPrjLocation}
                    onChange={(e) => setNewPrjLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsNewProjectModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Crear Proyecto y Asignar Presupuesto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Remisión Imprimible */}
      {isBudgetAdjustmentOpen && selectedProject && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="budget-adjustment-title"><div className="modal-content"><div className="modal-header"><h2 id="budget-adjustment-title">Ajustar presupuesto</h2><button type="button" aria-label="Cerrar" onClick={() => setIsBudgetAdjustmentOpen(false)}>×</button></div><p>Proyecto: <strong>{selectedProject.name}</strong></p><form onSubmit={handleBudgetAdjustment}><div className="form-group"><label>Valor del ajuste (COP):</label><input type="number" required placeholder="Use un valor negativo para disminuir" value={budgetAdjustment} onChange={(e) => setBudgetAdjustment(e.target.value)} /></div><div className="form-group"><label>Motivo:</label><input type="text" required placeholder="Ej. Adición contractual" value={budgetReason} onChange={(e) => setBudgetReason(e.target.value)} /></div><div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setIsBudgetAdjustmentOpen(false)}>Cancelar</button><button type="submit" className="btn-submit">Aplicar ajuste</button></div></form></div></div>
      )}

      <PrintableDispatchVoucher
        movement={selectedVoucherMovement}
        project={selectedProject}
        onClose={() => setSelectedVoucherMovement(null)}
      />
    </main>
  );
}
