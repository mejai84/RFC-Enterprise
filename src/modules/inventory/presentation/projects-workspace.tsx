"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  inventoryProducts,
  inventoryProjects,
  inventoryRequisitions,
  inventoryToolLoans,
  sampleInitialMovements,
  getNextProjectCode,
  getInventoryItemKind,
  projectTypeOptions,
  type InventoryMovement,
  type AssignedProjectEmployee,
  type MaterialRequisition,
  type Project,
  type ProjectType,
  type StockProduct,
  type ToolLoan,
} from "../index";
import { PrintableDispatchVoucher } from "./printable-dispatch-voucher";
import { CurrencyInput } from "@/shared/components/currency-input";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { getEffectiveQuoteCode, initialQuotes, type Quote } from "@/modules/quotes";
import { prepareRealDataStorage } from "@/shared/browser/real-data-storage";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

type ProjectTabIconName = "materials" | "tools" | "budget" | "team" | "requisitions";

function ProjectTabIcon({ name }: { name: ProjectTabIconName }) {
  const paths = {
    materials: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></>,
    tools: <><path d="m14.7 6.3 3-3a4 4 0 0 1-5.4 5.4l-7.5 7.5a2.1 2.1 0 0 0 3 3l7.5-7.5a4 4 0 0 1 5.4-5.4l-3 3" /></>,
    budget: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    team: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0M18 8a2.5 2.5 0 0 1 0 5M19 16a4.5 4.5 0 0 1 2 3.8" /></>,
    requisitions: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v3h6V3M8 11h8M8 15h5" /></>,
  }[name];
  return <svg aria-hidden="true" className="project-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
}

function ProjectHelp({ text, label = "Ayuda" }: { text: string; label?: string }) {
  return (
    <span className="project-help">
      <button type="button" className="project-help-trigger" aria-label={label}>?</button>
      <span className="project-help-popover" role="tooltip">{text}</span>
    </span>
  );
}

export function ProjectsWorkspace({ responsibleName, initialProducts = [] }: { responsibleName: string; initialProducts?: StockProduct[] }) {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => isSupabaseConfigured && supabaseUrl && supabasePublishableKey ? createBrowserClient(supabaseUrl, supabasePublishableKey) : null, []);
  // Sincronización con localStorage
  const [products, setProducts] = useState<StockProduct[]>(() => {
    prepareRealDataStorage();
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_products");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return initialProducts;
  });

  const [movements, setMovements] = useState<InventoryMovement[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_movements");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [];
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_projects");
      if (saved) {
        try {
          const storedProjects = JSON.parse(saved) as Project[];
          const requestedProjectId = searchParams.get("projectId");
          const requestedInitialProject = inventoryProjects.find((project) => project.id === requestedProjectId);
          return requestedInitialProject && !storedProjects.some((project) => project.id === requestedInitialProject.id)
            ? [...storedProjects, requestedInitialProject]
            : storedProjects;
        } catch {}
      }
    }
    return [];
  });
  const [quotes] = useState<Quote[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("rfc_quotes");
        if (saved) return JSON.parse(saved) as Quote[];
      } catch { /* Use catalogue examples when offline. */ }
    }
    return [];
  });

  const [requisitions, setRequisitions] = useState<MaterialRequisition[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_requisitions");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [];
  });

  const [toolLoans, setToolLoans] = useState<ToolLoan[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rfc_inventory_tool_loans");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [];
  });

  // Selected Project State
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => searchParams.get("projectId") ?? "");
  const [activeTab, setActiveTab] = useState<"materials" | "tools" | "requisitions" | "budget" | "team">("materials");
  const [projectStatusFilter, setProjectStatusFilter] = useState<"all" | Project["status"]>("all");

  // Modals
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [reopenHistory, setReopenHistory] = useState<Array<{ projectId: string; reason: string; occurredAt: string }>>([]);
  const [isBudgetAdjustmentOpen, setIsBudgetAdjustmentOpen] = useState(false);
  const [selectedVoucherMovement, setSelectedVoucherMovement] = useState<InventoryMovement | null>(null);
  const [availableEmployees, setAvailableEmployees] = useState<AssignedProjectEmployee[]>([]);
  const [employeeToAssignId, setEmployeeToAssignId] = useState("");
  const [toolProductId, setToolProductId] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [toolResponsibleId, setToolResponsibleId] = useState("");
  const [toolExpectedReturnDate, setToolExpectedReturnDate] = useState("");
  const [toolLoanNotes, setToolLoanNotes] = useState("");
  const [isToolLoanFormOpen, setIsToolLoanFormOpen] = useState(false);
  const [toolLoanToReturn, setToolLoanToReturn] = useState<ToolLoan | null>(null);
  const [toolReturnStatus, setToolReturnStatus] = useState<"returned" | "damaged">("returned");
  const [toolReturnNotes, setToolReturnNotes] = useState("");

  // Dispatch Form State
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [quantityInput, setQuantityInput] = useState("");
  const [responsibleInput, setResponsibleInput] = useState("Maestro de Obra");
  const [notesInput, setNotesInput] = useState("");

  function openDispatchModal() {
    setIsDispatchModalOpen(true);
  }

  // New Project Form State
  const [newPrjType, setNewPrjType] = useState<ProjectType>("obra");
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
  const [budgetResponsible, setBudgetResponsible] = useState(responsibleName);

  async function openTeamTab() {
    setActiveTab("team");
    if (!supabase) return;
    const { data } = await supabase.from("employees").select("id, full_name, job_title").eq("is_active", true).order("full_name");
    setAvailableEmployees((data ?? []).map((employee) => ({ id: employee.id, name: employee.full_name, title: employee.job_title })));
  }

  function addEmployeeToProject() {
    if (!selectedProject) return;
    const employee = availableEmployees.find((item) => item.id === employeeToAssignId);
    if (!employee || selectedProject.assignedEmployees?.some((item) => item.id === employee.id)) return;
    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProject.id) return project;
      const assigned = project.assignedEmployees ?? [];
      return { ...project, assignedEmployees: [...assigned, employee] };
    }));
    setEmployeeToAssignId("");
  }

  function removeAssignedEmployee(employeeId: string) {
    if (!selectedProject) return;
    setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, assignedEmployees: (project.assignedEmployees ?? []).filter((employee) => employee.id !== employeeId) } : project));
  }

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
    return projects.find((p) => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);
  const sourceQuote = useMemo(() => {
    if (!selectedProject) return undefined;
    return quotes.find((quote) => quote.id === selectedProject.sourceQuoteId || quote.projectId === selectedProject.id || quote.projectCode === selectedProject.code);
  }, [quotes, selectedProject]);
  const sourceQuoteCode = sourceQuote ? getEffectiveQuoteCode(sourceQuote) : selectedProject?.sourceQuoteCode;
  const sourceQuoteId = sourceQuote?.id ?? selectedProject?.sourceQuoteId;
  const newPrjCode = useMemo(
    () => getNextProjectCode(projects, newPrjType, newPrjStartDate),
    [newPrjStartDate, newPrjType, projects],
  );
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
  const availableTools = useMemo(
    () => products.filter((product) => (getInventoryItemKind(product) === "tool" || getInventoryItemKind(product) === "equipment") && product.available > 0),
    [products],
  );
  const filteredAvailableTools = useMemo(() => {
    const search = toolSearch.trim().toLocaleLowerCase("es-CO");
    if (!search) return availableTools.slice(0, 12);
    return availableTools.filter((tool) => `${tool.name} ${tool.sku} ${tool.category} ${tool.brand}`.toLocaleLowerCase("es-CO").includes(search)).slice(0, 12);
  }, [availableTools, toolSearch]);

  function handleToolLoanSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    const tool = availableTools.find((product) => product.id === toolProductId);
    const responsible = selectedProject.assignedEmployees?.find((employee) => employee.id === toolResponsibleId);
    if (!tool || !responsible) return alert("Seleccione una herramienta disponible y la persona responsable.");

    const newLoan: ToolLoan = {
      id: `loan-${Date.now()}`,
      code: `PRST-${new Date().getFullYear()}-${String(toolLoans.length + 1).padStart(3, "0")}`,
      toolId: tool.id,
      toolName: tool.name,
      workerName: `${responsible.name}${responsible.title ? ` (${responsible.title})` : ""}`,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      loanDate: formatDateTime(),
      expectedReturnDate: toolExpectedReturnDate || undefined,
      status: "active",
      notes: toolLoanNotes.trim() || undefined,
    };

    setToolLoans((current) => [newLoan, ...current]);
    setProducts((current) => current.map((product) => product.id === tool.id ? { ...product, available: product.available - 1 } : product));
    setToolProductId("");
    setToolSearch("");
    setToolResponsibleId("");
    setToolExpectedReturnDate("");
    setToolLoanNotes("");
    setIsToolLoanFormOpen(false);
  }

  function cancelToolAssignment(loan: ToolLoan) {
    if (!window.confirm(`¿Anular la asignación de ${loan.toolName}? La herramienta volverá a estar disponible.`)) return;
    setToolLoans((current) => current.filter((item) => item.id !== loan.id));
    setProducts((current) => current.map((product) => product.id === loan.toolId ? { ...product, available: product.available + 1 } : product));
  }

  function handleToolReturnSubmit(event: FormEvent) {
    event.preventDefault();
    if (!toolLoanToReturn) return;
    const returnedAt = formatDateTime();
    setToolLoans((current) => current.map((loan) => loan.id === toolLoanToReturn.id ? {
      ...loan,
      status: toolReturnStatus,
      actualReturnDate: returnedAt,
      notes: [loan.notes, toolReturnNotes.trim()].filter(Boolean).join(" · ") || undefined,
    } : loan));
    if (toolReturnStatus === "returned") {
      setProducts((current) => current.map((product) => product.id === toolLoanToReturn.toolId ? { ...product, available: product.available + 1 } : product));
    }
    setToolLoanToReturn(null);
    setToolReturnStatus("returned");
    setToolReturnNotes("");
  }

  // Handle Dispatch Form Submit
  const handleDispatchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return alert("Seleccione una obra antes de registrar un despacho.");
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
      code: newPrjCode,
      type: newPrjType,
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
    setNewPrjType("obra");
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
    let actualEndDate = selectedProject.actualEndDate;
    if (editStatus === "completed") {
      actualEndDate = window.prompt("Fecha real de entrega o finalización (AAAA-MM-DD):", actualEndDate || editEstimatedEndDate) || "";
      if (!actualEndDate) return;
      if (actualEndDate < editStartDate) return alert("La fecha real de entrega no puede ser anterior al inicio de la obra.");
    }
    setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, startDate: editStartDate, estimatedEndDate: editEstimatedEndDate, actualEndDate, status: editStatus } : project));
    setIsEditProjectModalOpen(false);
  };
  function reopenProject() {
    if (!selectedProject || selectedProject.status !== "completed") return;
    const reason = window.prompt("Motivo obligatorio para reabrir la obra:");
    if (!reason?.trim()) return;
    const newEndDate = window.prompt("Nueva fecha estimada de finalización (AAAA-MM-DD):", selectedProject.estimatedEndDate || "");
    if (!newEndDate || newEndDate < (selectedProject.startDate || "")) return alert("Indique una fecha posterior al inicio de la obra.");
    setProjects(current => current.map(project => project.id === selectedProject.id ? { ...project, status: "active", estimatedEndDate: newEndDate, actualEndDate: undefined } : project));
    setReopenHistory(current => [...current, { projectId: selectedProject.id, reason: reason.trim(), occurredAt: new Date().toLocaleString("es-CO") }]);
  }

  const handleBudgetAdjustment = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(budgetAdjustment);
    if (!selectedProject || !amount || !budgetReason.trim() || !budgetResponsible.trim()) return alert("Indique el valor, motivo y responsable del ajuste.");
    if (selectedProject.budget + amount < projectSpent) return alert("El nuevo presupuesto no puede ser menor al gasto acumulado.");
    setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, budget: project.budget + amount, budgetAdjustments: [...(project.budgetAdjustments || []), { id: `budget-${Date.now()}`, amount, reason: budgetReason.trim(), responsible: budgetResponsible.trim(), occurredAt: new Date().toLocaleDateString("es-CO") }] } : project));
    setBudgetAdjustment(""); setBudgetReason(""); setIsBudgetAdjustmentOpen(false);
  };

  return (
    <main className="dashboard-content dashboard-v3" id="main-content" tabIndex={-1}>
      {/* Header */}
      <section className="dashboard-heading">
        <div>
          <p>Módulo de Obras & Frente de Trabajo</p>
          <div className="project-heading-with-help"><h1>Centro de Costos de Proyectos</h1><ProjectHelp label="Ayuda del módulo de Obras y Proyectos" text="Aquí administra cada obra: revise presupuesto y gastos, despache recursos, asigne personal y consulte la cotización que originó el trabajo." /></div>
          <small>Consulta detallada del consumo de materiales, insumos gastados y herramientas en custodia por obra.</small>
        </div>
        <div className="dash-quick-btns">
          <button className="inventory-action btn-edit-project" title="Modifique fechas, estado, cliente y datos de la obra seleccionada." onClick={() => setIsProjectPickerOpen(true)}>
            Editar proyecto
          </button>
          {selectedProject?.status === "completed" && <button className="inventory-action btn-secondary-action" title="Vuelve la obra a activa; requiere motivo y nueva fecha estimada." onClick={reopenProject}>Reabrir proyecto</button>}
          <button className="inventory-action btn-budget-adjustment" title="Registra una adición o reducción presupuestal, con motivo y responsable." onClick={() => setIsBudgetAdjustmentOpen(true)}>Ajustar presupuesto</button>
          <button className="inventory-action btn-primary-action" title="Registra la salida de materiales o insumos a la obra seleccionada." onClick={openDispatchModal}>
            📤 Despachar a esta Obra
          </button>
          <button className="inventory-action btn-new-project" title="Crea una obra o proyecto independiente. Para una cotización aprobada, use Convertir a Obra desde Cotizaciones." onClick={() => setIsNewProjectModalOpen(true)}>
            ➕ Nueva Obra / Proyecto
          </button>
        </div>
      </section>

      {/* Projects Navigation Selector */}
      <section className="projects-selector-bar">
        <span className="selector-label">Seleccionar Obra: <ProjectHelp label="Ayuda para seleccionar una obra" text="Elija una obra para abrir su ficha. El filtro Estado reduce la lista sin eliminar información." /></span>
        <label className="project-status-filter">Estado <select aria-label="Filtrar obras por estado" value={projectStatusFilter} onChange={(event) => { setProjectStatusFilter(event.target.value as "all" | Project["status"]); setSelectedProjectId(""); }}><option value="all">Todas</option><option value="pending">Pendientes</option><option value="active">Activas</option><option value="on_hold">En pausa</option><option value="completed">Finalizadas</option></select></label>
        <div className="selector-pills">
          {visibleProjects.map((prj) => (
            <button
              key={prj.id}
              className={`prj-pill status-${prj.status} ${prj.id === selectedProjectId ? "is-selected" : ""}`}
              title={`Abrir ficha de ${prj.code}`}
              onClick={() => setSelectedProjectId(prj.id)}
            >
              <span className="pill-code">{prj.code}</span>
              <strong className="pill-name">{prj.name}</strong>
            </button>
          ))}
          {visibleProjects.length === 0 && <p className="project-filter-empty">No hay obras con este estado.</p>}
        </div>
      </section>

      {!selectedProject && <p className="project-selection-empty">Seleccione una obra para consultar su ficha, costos y movimientos.</p>}

      {/* Selected Project Full Ficha */}
      {selectedProject && (
        <section className="project-detail-container">
          {/* Main Ficha Card */}
          <div className="project-main-card">
            <div className="card-top-info">
              <div>
                <span className="prj-code-badge">{selectedProject.code}</span>
                <h2>{selectedProject.name}</h2>
                {selectedProject.actualEndDate ? <p>Entrega real: <strong>{selectedProject.actualEndDate}</strong></p> : null}
                {sourceQuoteId && sourceQuoteCode ? (
                  <Link className="project-source-quote" href={`/quotes?quoteId=${encodeURIComponent(sourceQuoteId)}`}>
                    <span className="project-source-quote-label">Cotización de origen</span>
                    <strong>{sourceQuoteCode}</strong>
                    <span className="project-source-quote-action">Abrir cotización →</span>
                  </Link>
                ) : null}
                <p>Cliente: <strong>{selectedProject.client}</strong> · Ubicación: <strong>{selectedProject.location}</strong></p>
                {selectedProject.assignedEmployees?.length ? <p>Personal asignado: <strong>{selectedProject.assignedEmployees.map((employee) => employee.name).join(", ")}</strong></p> : null}
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
            title="Consulta las salidas de materiales e insumos y su costo acumulado."
            className={`tab-btn ${activeTab === "materials" ? "is-active" : ""}`}
              style={{ order: 1 }}
              onClick={() => setActiveTab("materials")}
            >
              <ProjectTabIcon name="materials" />Materiales e insumos gastados ({projectMovements.length}) <span className="sr-only">: consulta las salidas registradas y sus costos.</span>
          </button>
          <button title="Consulta las adiciones y reducciones autorizadas al presupuesto." style={{ order: 5 }} className={`tab-btn ${activeTab === "budget" ? "is-active" : ""}`} onClick={() => setActiveTab("budget")}><ProjectTabIcon name="budget" />Ajustes de presupuesto ({selectedProject.budgetAdjustments?.length || 0})</button>
          <button
            title="Controle préstamos, responsables y devoluciones de herramientas de esta obra."
            className={`tab-btn ${activeTab === "tools" ? "is-active" : ""}`}
              style={{ order: 2 }}
              onClick={() => setActiveTab("tools")}
            >
              <ProjectTabIcon name="tools" />Herramientas en custodia ({projectTools.length})
            </button>
            <button
              title="Consulte las solicitudes de materiales pendientes, aprobadas o atendidas."
              className={`tab-btn ${activeTab === "requisitions" ? "is-active" : ""}`}
              style={{ order: 4 }}
              onClick={() => setActiveTab("requisitions")}
            >
              <ProjectTabIcon name="requisitions" />Requisiciones ({projectRequisitions.length})
            </button>
            <button title="Asigne o retire empleados responsables de la obra." style={{ order: 3 }} className={`tab-btn ${activeTab === "team" ? "is-active" : ""}`} onClick={() => void openTeamTab()}><ProjectTabIcon name="team" />Personal de obra ({selectedProject.assignedEmployees?.length || 0})</button>
          </div>

          {/* TAB 1: Materiales e Insumos Gastados */}
          {activeTab === "materials" && (
            <div className="project-tab-content">
              <div className="tab-actions-bar">
                <h3>Historial Valorizado de Insumos Despachados a esta Obra</h3>
                <button className="btn-mini-dispatch" onClick={openDispatchModal}>
                  + Despachar Insumos
                </button>
              </div>

              {projectMovements.length === 0 ? (
                <div className="empty-state-box">
                  <p>Aún no se han registrado despachos de material para esta obra.</p>
                  <button className="btn-submit" onClick={openDispatchModal}>
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
          {activeTab === "budget" && (
            <div className="project-tab-content"><div className="materials-history-card"><h3>Historial de ajustes</h3>{selectedProject.budgetAdjustments?.length ? <table className="project-history-table"><thead><tr><th>Fecha</th><th>Responsable</th><th>Motivo</th><th>Valor</th></tr></thead><tbody>{selectedProject.budgetAdjustments.map((adjustment) => <tr key={adjustment.id}><td>{adjustment.occurredAt}</td><td>{adjustment.responsible}</td><td>{adjustment.reason}</td><td className={adjustment.amount > 0 ? "text-success" : "text-danger"}>{adjustment.amount > 0 ? "+" : ""}{currencyFormatter.format(adjustment.amount)}</td></tr>)}</tbody></table> : <p className="empty-state">Todavía no hay ajustes presupuestales registrados para esta obra.</p>}</div></div>
          )}

          {activeTab === "tools" && (
            <div className="project-tab-content">
              <div className="tab-actions-bar">
                <div><h3>Herramientas y Equipos en Custodia</h3><p className="panel-intro">Asigne una herramienta disponible a una persona del equipo y registre su devolución desde esta misma obra.</p></div>
                <button type="button" className="btn-mini-add" onClick={() => setIsToolLoanFormOpen(true)}>+ Asignar herramienta</button>
              </div>

              {isToolLoanFormOpen && <form className="materials-history-card" onSubmit={handleToolLoanSubmit}>
                <h4>Asignar herramienta a esta obra</h4>
                {selectedProject.assignedEmployees?.length ? (
                  <>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label htmlFor="tool-search">Buscar herramienta o equipo disponible</label>
                        <input id="tool-search" type="search" autoComplete="off" placeholder="Nombre, código, marca o categoría" value={toolSearch} onChange={(event) => setToolSearch(event.target.value)} />
                        <div className="autocomplete-results">
                          {filteredAvailableTools.length ? filteredAvailableTools.map((tool) => <button className="autocomplete-option" key={tool.id} type="button" onClick={() => { setToolProductId(tool.id); setToolSearch(tool.name); }}><div><strong>{tool.name}</strong><small>{tool.category} · {getInventoryItemKind(tool) === "equipment" ? "Equipo" : "Herramienta"}</small></div><b>Disp. {tool.available}</b></button>) : <p className="empty-state">No se encontraron herramientas disponibles.</p>}
                        </div>
                        <label htmlFor="tool-product">Herramienta seleccionada</label>
                        <select id="tool-product" required value={toolProductId} onChange={(event) => setToolProductId(event.target.value)}>
                          <option value="">Seleccione una herramienta</option>
                          {availableTools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name} · Disponibles: {tool.available}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="tool-responsible">Responsable en obra</label>
                        <select id="tool-responsible" required value={toolResponsibleId} onChange={(event) => setToolResponsibleId(event.target.value)}>
                          <option value="">Seleccione una persona</option>
                          {selectedProject.assignedEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.title}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="form-group"><label htmlFor="tool-expected-return">Fecha prevista de devolución</label><input id="tool-expected-return" type="date" min={new Date().toISOString().slice(0, 10)} value={toolExpectedReturnDate} onChange={(event) => setToolExpectedReturnDate(event.target.value)} /></div>
                      <div className="form-group"><label htmlFor="tool-loan-notes">Estado inicial / observaciones</label><input id="tool-loan-notes" type="text" placeholder="Ej. Entregada completa y en buen estado" value={toolLoanNotes} onChange={(event) => setToolLoanNotes(event.target.value)} /></div>
                    </div>
                    <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setIsToolLoanFormOpen(false)}>Cancelar</button><button className="btn-submit" type="submit" disabled={!availableTools.length}>Registrar custodia</button></div>
                  </>
                ) : <p className="empty-state">Primero agregue al responsable en la pestaña <strong>Personal de obra</strong>.</p>}
              </form>}

              {projectTools.length === 0 ? <div className="empty-state-box"><p>No hay herramientas asignadas en custodia a esta obra.</p></div> : (
                <div className="tools-grid-view">
                  {projectTools.map((tool) => (
                    <div className={`tool-card status-${tool.status}`} key={tool.id}>
                      <div className="tool-card-icon">🛠️</div>
                      <div>
                        <strong>{tool.toolName}</strong>
                        <p>Responsable: <strong>{tool.workerName}</strong></p>
                        <small>Salida: {tool.loanDate} · {tool.status === "active" ? "En custodia" : tool.status === "damaged" ? "Devuelta con novedad" : "Devuelta"}</small>
                        {tool.expectedReturnDate ? <small>Devolución prevista: {tool.expectedReturnDate}</small> : null}
                        {tool.actualReturnDate ? <small>Devolución registrada: {tool.actualReturnDate}</small> : null}
                        {tool.notes ? <small>Observación: {tool.notes}</small> : null}
                      </div>
                      {tool.status === "active" ? <div className="tool-card-actions"><button type="button" className="btn-return-tool" onClick={() => setToolLoanToReturn(tool)}>Registrar devolución</button><button type="button" className="btn-cancel" onClick={() => cancelToolAssignment(tool)}>Anular asignación</button></div> : null}
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

          {activeTab === "team" && (
            <div className="project-tab-content">
              <div className="materials-history-card">
                <h3>Personal de obra</h3>
                <p className="panel-intro">Selecciona una persona del directorio y agrégala a esta obra. Puedes retirarla si fue asignada por error.</p>
                {availableEmployees.length ? <div className="form-row-2"><div className="form-group"><label htmlFor="project-employee">Empleado disponible</label><select id="project-employee" value={employeeToAssignId} onChange={(event) => setEmployeeToAssignId(event.target.value)}><option value="">Selecciona un empleado</option>{availableEmployees.filter((employee) => !selectedProject.assignedEmployees?.some((item) => item.id === employee.id)).map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.title}</option>)}</select></div><div className="form-group"><label>&nbsp;</label><button type="button" className="btn-submit" disabled={!employeeToAssignId} onClick={addEmployeeToProject}>Agregar a la obra</button></div></div> : <p className="empty-state">No hay empleados activos disponibles en el directorio.</p>}
                {selectedProject.assignedEmployees?.length ? <div className="project-team-list">{selectedProject.assignedEmployees.map((employee) => <div key={employee.id} className="employee-team-option"><span><strong>{employee.name}</strong><small>{employee.title}</small></span><button type="button" className="btn-cancel" onClick={() => removeAssignedEmployee(employee.id)}>Retirar</button></div>)}</div> : <p className="empty-state">Aún no hay personal asignado a esta obra.</p>}
              </div>
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
            <form noValidate onSubmit={handleDispatchSubmit}>
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
            <form onSubmit={handleEditProjectSubmit}>
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="edit-project-start-date">Fecha de inicio</label>
                  <input id="edit-project-start-date" type="date" required value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-project-estimated-end-date">Fecha estimada de finalización</label>
                  <input id="edit-project-estimated-end-date" type="date" required min={editStartDate} value={editEstimatedEndDate} onChange={(e) => setEditEstimatedEndDate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="edit-project-status">Estado</label>
                <select id="edit-project-status" value={editStatus} onChange={(e) => setEditStatus(e.target.value as Project["status"])}>
                  <option value="pending">Pendiente</option><option value="active">Activa</option><option value="on_hold">En pausa</option><option value="completed">Finalizada</option>
                </select>
                <small>Al finalizar, se solicitará la fecha real de entrega.</small>
              </div>
              <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setIsEditProjectModalOpen(false)}>Cancelar</button><button type="submit" className="btn-submit">Guardar cambios</button></div>
            </form>
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
                  <label htmlFor="new-project-type">Tipo de proyecto:</label>
                  <select id="new-project-type" value={newPrjType} onChange={(event) => setNewPrjType(event.target.value as ProjectType)}>
                    {projectTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="new-project-code">Código asignado automáticamente:</label>
                  <input
                    id="new-project-code"
                    type="text"
                    readOnly
                    value={newPrjCode}
                  />
                  <small>El consecutivo se calcula por tipo y fecha de inicio.</small>
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Presupuesto de Materiales ($ COP):</label>
                  <CurrencyInput
                    required
                    placeholder="ej. 25000000"
                    value={newPrjBudget}
                    onValueChange={setNewPrjBudget}
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

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="new-project-start-date">Fecha de inicio:</label>
                  <input
                    id="new-project-start-date"
                    type="date"
                    required
                    value={newPrjStartDate}
                    onChange={(event) => setNewPrjStartDate(event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-project-estimated-end-date">Fecha posible de finalización:</label>
                  <input
                    id="new-project-estimated-end-date"
                    type="date"
                    required
                    min={newPrjStartDate}
                    value={newPrjEstimatedEndDate}
                    onChange={(event) => setNewPrjEstimatedEndDate(event.target.value)}
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
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="budget-adjustment-title"><div className="modal-content budget-adjustment-modal"><div className="modal-header"><h2 id="budget-adjustment-title">Ajustar presupuesto</h2><button type="button" aria-label="Cerrar" onClick={() => setIsBudgetAdjustmentOpen(false)}>×</button></div><p>Proyecto: <strong>{selectedProject.name}</strong></p><form onSubmit={handleBudgetAdjustment}><div className="form-group"><label>Valor del ajuste (COP):</label><CurrencyInput required placeholder="Use un valor negativo para disminuir" value={budgetAdjustment} onValueChange={setBudgetAdjustment} /></div><div className="form-group"><label>Motivo:</label><input type="text" required placeholder="Ej. Adición contractual" value={budgetReason} onChange={(e) => setBudgetReason(e.target.value)} /></div><div className="form-group"><label>Responsable:</label><input type="text" readOnly value={budgetResponsible} /></div><div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setIsBudgetAdjustmentOpen(false)}>Cancelar</button><button type="submit" className="btn-submit">Aplicar ajuste</button></div></form></div></div>
      )}

      {toolLoanToReturn && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="return-tool-title">
          <div className="modal-content">
            <div className="modal-header"><h2 id="return-tool-title">Registrar devolución</h2><button type="button" aria-label="Cerrar" onClick={() => setToolLoanToReturn(null)}>×</button></div>
            <p>Herramienta: <strong>{toolLoanToReturn.toolName}</strong></p>
            <p>Responsable: <strong>{toolLoanToReturn.workerName}</strong></p>
            <form onSubmit={handleToolReturnSubmit}>
              <div className="form-group">
                <label htmlFor="tool-return-status">Estado al recibir</label>
                <select id="tool-return-status" value={toolReturnStatus} onChange={(event) => setToolReturnStatus(event.target.value as "returned" | "damaged")}>
                  <option value="returned">Devuelta en buen estado</option>
                  <option value="damaged">Devuelta con novedad o dañada</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tool-return-notes">Observaciones de devolución</label>
                <input id="tool-return-notes" type="text" required={toolReturnStatus === "damaged"} placeholder={toolReturnStatus === "damaged" ? "Describa la novedad" : "Ej. Recibida completa y operativa"} value={toolReturnNotes} onChange={(event) => setToolReturnNotes(event.target.value)} />
              </div>
              <small>La fecha y hora de devolución se registran automáticamente al confirmar.</small>
              <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setToolLoanToReturn(null)}>Cancelar</button><button type="submit" className="btn-submit">Confirmar devolución</button></div>
            </form>
          </div>
        </div>
      )}

      <PrintableDispatchVoucher
        movement={selectedVoucherMovement}
        project={selectedProject}
        onClose={() => setSelectedVoucherMovement(null)}
      />
    </main>
  );
}
