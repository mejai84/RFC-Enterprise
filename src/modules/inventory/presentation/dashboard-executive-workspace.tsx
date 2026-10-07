"use client";

import { useEffectivePermissions } from "@/core/permissions/use-effective-permissions";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
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
  withDefaultInventoryAliases,
} from "../index";
import { PrintableDispatchVoucher } from "./printable-dispatch-voucher";
import { SearchableProductPicker } from "./searchable-product-picker";
import {
  daysSince,
  initialQuotes,
  isStale,
  type Quote,
} from "@/modules/quotes";
import { type Apu } from "@/modules/apu";
import { SignatureCapture } from "@/shared/components/signature-capture";
import { prepareRealDataStorage } from "@/shared/browser/real-data-storage";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO");
const spanishCollator = new Intl.Collator("es-CO", {
  numeric: true,
  sensitivity: "base",
});

type AlertSeverity = "critical" | "warning" | "info";
type OperationalAlert = {
  id: string;
  severity: AlertSeverity;
  source: string;
  title: string;
  detail: string;
  href: string;
};

function AlertSourceIcon({ source }: { source: string }) {
  const path =
    source === "Cotizaciones" ? (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="m4 7 8 5 8-5M8 15h8" />
      </>
    ) : source === "APU" ? (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ) : source === "Inventario" ? (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
      </>
    ) : (
      <>
        <path d="M4 21V5h16v16M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01" />
      </>
    );
  return (
    <svg
      className="operational-alert-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

function daysUntil(isoDate: string) {
  const target = new Date(`${isoDate}T23:59:59`).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function formatDateTime(fecha?: string | null) {
  // Sin argumento se usa la hora local; con argumento se muestra la que devolvio
  // el servidor, que es la unica que vale como hora oficial de un documento.
  const date = fecha ? new Date(fecha) : new Date();
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function inventoryClient() {
  return isSupabaseConfigured && supabaseUrl && supabasePublishableKey
    ? createBrowserClient(supabaseUrl, supabasePublishableKey)
    : null;
}

export function DashboardExecutiveWorkspace({
  initialProducts = [],
}: {
  initialProducts?: StockProduct[];
}) {
  const [viewerName, setViewerName] = useState("Usuario");
  // El Resumen se arma según lo que la persona puede ver. Antes mostraba a todos
  // los indicadores financieros y el conteo de cotizaciones, el APU y las obras,
  // incluso a quien solo registra su jornada.
  const { permissions, isLoading: arePermissionsLoading } = useEffectivePermissions();
  const has = (code: string) => !permissions || permissions.includes(code);
  const canViewFinancials = has("dashboard.financials.view");
  const canViewQuotes = has("quotes.view") || has("quotes.manage");
  const canViewApu = has("apu.view") || has("apu.manage");
  const canViewProjects = has("projects.view") || has("projects.manage");
  const [scope, setScope] = useState<{ companyId: string; branchId: string } | null>(null);
  // Estado operativo proveniente de Supabase.
  const [products, setProducts] = useState<StockProduct[]>(initialProducts);

  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);

  const [requisitions, setRequisitions] = useState<MaterialRequisition[]>([]);

  const [toolLoans, setToolLoans] = useState<ToolLoan[]>([]);

  const [quotes, setQuotes] = useState<Quote[]>([]);

  const [apus, setApus] = useState<Apu[]>([]);

  useEffect(() => {
    const supabase = inventoryClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user || !active) return;
      const fallback = String(user.user_metadata.full_name || user.email || "Usuario");
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      const { data: membership } = await supabase.from("user_roles").select("company_id,branch_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (membership?.company_id && membership.branch_id && active) setScope({ companyId: membership.company_id, branchId: membership.branch_id });
      if (active) setViewerName(profile?.display_name?.trim() || fallback);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const supabase = inventoryClient();
    if (!supabase) return;

    const loadSharedOperations = async () => {
      const [projectResult, requisitionResult, quoteResult, apuResult, movementResult, toolLoanResult] = await Promise.all([
        supabase
          .from("projects")
          .select("id,code,name,client,location,material_budget,status,start_date,estimated_end_date,actual_end_date,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("inventory_requisitions")
          .select("id,code,project_id,requested_by_name,status,created_at,needed_by,notes,project:projects(name),lines:inventory_requisition_lines(stock_id,item_name_snapshot,requested_quantity,unit_snapshot,unit_cost_snapshot)")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("quotes").select("*").order("created_at", { ascending: false }),
        supabase.from("apu_analyses").select("*").order("created_at", { ascending: false }),
        supabase.from("inventory_movements").select("id,stock_id,movement_type,quantity,unit_cost,reference,notes,occurred_at,project_id,inventory_stock!inner(inventory_items!inner(name,unit)),projects(name)").order("occurred_at", { ascending: false }),
        supabase.from("inventory_tool_loans").select("id,code,stock_id,worker_name,project_id,status,notes,created_at,expected_return_date,returned_at,delivery_signature_data,return_signature_data,inventory_stock!inner(inventory_items!inner(name)),projects(name)").order("created_at", { ascending: false }).limit(50),
      ]);

      if (!projectResult.error && projectResult.data?.length) {
        const remoteProjects = projectResult.data.map((project) => ({
          id: project.id,
          code: project.code,
          name: project.name,
          client: project.client,
          location: project.location ?? "Sin ubicación",
          budget: Number(project.material_budget ?? 0),
          status: (project.status === "completed" ? "completed" : project.status === "on_hold" ? "on_hold" : project.status === "active" ? "active" : "pending") as Project["status"],
          type: "obra" as const,
          createdAt: project.created_at,
          startDate: project.start_date,
          estimatedEndDate: project.estimated_end_date,
          actualEndDate: project.actual_end_date,
        }));
        setProjects(remoteProjects);
        setReqProject((current) => current || remoteProjects[0]?.id || "");
      }

      if (!requisitionResult.error && requisitionResult.data) {
        setRequisitions(
          requisitionResult.data.map((requisition) => {
            const project = Array.isArray(requisition.project)
              ? requisition.project[0]
              : requisition.project;
            return {
              id: requisition.id,
              code: requisition.code,
              projectId: requisition.project_id,
              projectName: project?.name ?? "Obra sin nombre",
              requestedBy: requisition.requested_by_name,
              status: requisition.status === "submitted" ? "pending" : requisition.status as MaterialRequisition["status"],
              createdAt: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(requisition.created_at)),
              neededByDate: requisition.needed_by ?? undefined,
              notes: requisition.notes ?? undefined,
              items: (requisition.lines ?? []).map((line) => ({
                productId: line.stock_id,
                productName: line.item_name_snapshot,
                quantity: Number(line.requested_quantity),
                unit: line.unit_snapshot,
                unitCost: Number(line.unit_cost_snapshot),
              })),
            };
          }),
        );
      }
      if (!quoteResult.error && quoteResult.data) setQuotes(quoteResult.data as Quote[]);
      if (!apuResult.error && apuResult.data) setApus(apuResult.data as Apu[]);
      if (!movementResult.error && movementResult.data) setMovements(movementResult.data.map((movement) => { const stock = Array.isArray(movement.inventory_stock) ? movement.inventory_stock[0] : movement.inventory_stock; const item = stock && (Array.isArray(stock.inventory_items) ? stock.inventory_items[0] : stock.inventory_items); const project = Array.isArray(movement.projects) ? movement.projects[0] : movement.projects; return { id: movement.id, productId: movement.stock_id, productName: item?.name, type: movement.movement_type === "entry" ? "entry" : movement.movement_type === "exit" ? "exit" : "adjustment", quantity: Number(movement.quantity), unit: item?.unit, unitCost: Number(movement.unit_cost), totalCost: Number(movement.quantity) * Number(movement.unit_cost), occurredAt: movement.occurred_at, reference: movement.reference, projectId: movement.project_id ?? undefined, projectName: project?.name, notes: movement.notes ?? undefined }; }));
      // Los prestamos se leen de la base. Antes esta lista solo se llenaba al
      // prestar desde esta pantalla, de modo que al recargar aparecia vacia y
      // nadie veia los prestamos que si existian.
      if (!toolLoanResult.error && toolLoanResult.data) {
        setToolLoans(
          toolLoanResult.data.map((loan) => {
            const stock = Array.isArray(loan.inventory_stock)
              ? loan.inventory_stock[0]
              : loan.inventory_stock;
            const item =
              stock && (Array.isArray(stock.inventory_items) ? stock.inventory_items[0] : stock.inventory_items);
            const project = Array.isArray(loan.projects) ? loan.projects[0] : loan.projects;
            return {
              id: loan.id,
              code: loan.code ?? "Sin codigo",
              toolId: loan.stock_id,
              toolName: item?.name ?? "Herramienta",
              workerName: loan.worker_name,
              projectId: loan.project_id ?? "",
              projectName: project?.name ?? "Sin obra",
              loanDate: new Intl.DateTimeFormat("es-CO", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(new Date(loan.created_at)),
              expectedReturnDate: loan.expected_return_date ?? undefined,
              actualReturnDate: loan.returned_at
                ? new Intl.DateTimeFormat("es-CO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(loan.returned_at))
                : undefined,
              status: loan.status as ToolLoan["status"],
              notes: loan.notes ?? undefined,
              deliverySignatureDataUrl: loan.delivery_signature_data ?? undefined,
              returnSignatureDataUrl: loan.return_signature_data ?? undefined,
            };
          }),
        );
      }
    };

    void loadSharedOperations();
  }, []);

  useEffect(() => {
    const syncCommercialModules = () => {
      try {
        return;
      } catch {
        // Mantener el último resumen válido si el almacenamiento no está disponible.
      }
    };
    syncCommercialModules();
    window.addEventListener("focus", syncCommercialModules);
    window.addEventListener("storage", syncCommercialModules);
    return () => {
      window.removeEventListener("focus", syncCommercialModules);
      window.removeEventListener("storage", syncCommercialModules);
    };
  }, []);

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
      const progressPercent =
        prj.budget > 0
          ? Math.min(Math.round((spent / prj.budget) * 100), 100)
          : 0;

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
    const globalPercent =
      totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const criticalStockCount = products.filter(
      (p) => p.minimum !== null && p.available <= p.minimum,
    ).length;
    const activeProjectsCount = projects.filter(
      (p) => p.status === "active",
    ).length;
    const pendingReqsCount = requisitions.filter(
      (r) => r.status === "pending",
    ).length;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      globalPercent,
      criticalStockCount,
      activeProjectsCount,
      pendingReqsCount,
    };
  }, [projects, projectStats, products, requisitions]);

  // Contextual greeting
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Buenos días"
      : greetingHour < 18
        ? "Buenas tardes"
        : "Buenas noches";
  const todayFormatted = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // Top 5 Materiales más costosos
  const topMaterials = useMemo(() => {
    const spend: Record<
      string,
      { name: string; total: number; qty: number; unit: string }
    > = {};
    movements
      .filter((m) => m.type === "exit")
      .forEach((m) => {
        const key = m.productId;
        if (!spend[key])
          spend[key] = {
            name: m.productName || "Material",
            total: 0,
            qty: 0,
            unit: m.unit || "und",
          };
        spend[key].total += m.totalCost;
        spend[key].qty += m.quantity;
      });
    return Object.entries(spend)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [movements]);

  const topMaterialsMaxSpend =
    topMaterials.length > 0 ? topMaterials[0].total : 1;
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
  const activitySummary = useMemo(
    () => ({
      totalDispatches: movements.filter((m) => m.type === "exit").length,
      totalEntries: movements.filter((m) => m.type === "entry").length,
      activeTools: toolLoans.filter((t) => t.status === "active").length,
    }),
    [movements, toolLoans],
  );

  const commercialSummary = useMemo(() => {
    const inProgress = quotes.filter(
      (quote) =>
        quote.status === "estimating" || quote.status === "revision_requested",
    );
    const pendingReview = quotes.filter(
      (quote) => quote.status === "received" || quote.status === "in_review",
    );
    const confirmed = quotes.filter(
      (quote) =>
        quote.status === "confirmed" || quote.status === "in_execution",
    );
    const linkedApus = apus.filter((apu) => Boolean(apu.quoteId));
    const uncostedQuotes = inProgress.filter(
      (quote) => !linkedApus.some((apu) => apu.quoteId === quote.id),
    );
    return {
      inProgress,
      pendingReview,
      confirmed,
      linkedApus,
      uncostedQuotes,
      confirmedValue: confirmed.reduce(
        (total, quote) => total + (quote.estimatedValue ?? 0),
        0,
      ),
    };
  }, [quotes, apus]);

  const operationalAlerts = useMemo<OperationalAlert[]>(() => {
    const alerts: OperationalAlert[] = [];
    const closedStatuses = new Set(["closed", "lost", "work_completed"]);
    for (const quote of quotes) {
      if (isStale(quote)) {
        const days = daysSince(
          quote.history
            .filter((item) => item.toStatus === "awaiting_response")
            .sort((a, b) => b.changedAt.localeCompare(a.changedAt))[0]
            ?.changedAt ?? quote.updatedAt,
        );
        alerts.push({
          id: `stale-${quote.id}`,
          severity: days >= 7 ? "critical" : "warning",
          source: "Cotizaciones",
          title: `${quote.code} sin respuesta`,
          detail: `Lleva ${days} días esperando respuesta del cliente.`,
          href: "/quotes",
        });
      }
      if (quote.deadline && !closedStatuses.has(quote.status)) {
        const remaining = daysUntil(quote.deadline);
        if (remaining < 0)
          alerts.push({
            id: `overdue-${quote.id}`,
            severity: "critical",
            source: "Cotizaciones",
            title: `${quote.code} vencida`,
            detail: `La fecha límite venció hace ${Math.abs(remaining)} días.`,
            href: "/quotes",
          });
        else if (remaining <= 2)
          alerts.push({
            id: `due-${quote.id}`,
            severity: "warning",
            source: "Cotizaciones",
            title: `${quote.code} vence pronto`,
            detail:
              remaining === 0
                ? "La entrega vence hoy."
                : `La entrega vence en ${remaining} día${remaining === 1 ? "" : "s"}.`,
            href: "/quotes",
          });
      }
    }
    for (const quote of commercialSummary.uncostedQuotes)
      alerts.push({
        id: `apu-${quote.id}`,
        severity: "warning",
        source: "APU",
        title: `${quote.code} requiere APU`,
        detail:
          "Está en proceso de cotización y aún no tiene análisis de precios.",
        href: `/apu?quoteId=${encodeURIComponent(quote.id)}&quoteCode=${encodeURIComponent(quote.code)}&quoteTitle=${encodeURIComponent(quote.title)}`,
      });
    for (const item of criticalItems.slice(0, 3))
      alerts.push({
        id: `stock-${item.id}`,
        severity: item.available <= 0 ? "critical" : "warning",
        source: "Inventario",
        title: `${item.name} bajo mínimo`,
        detail:
          item.available <= 0
            ? "No hay existencias disponibles."
            : `Faltan ${item.deficit} ${item.unit} para el mínimo.`,
        href: "/inventory?tab=low-stock",
      });
    for (const project of projectStats.filter(
      (item) => item.progressPercent >= 80,
    ))
      alerts.push({
        id: `project-${project.id}`,
        severity: project.progressPercent >= 100 ? "critical" : "warning",
        source: "Obras",
        title: `${project.code} ${project.progressPercent >= 100 ? "supera" : "alcanza"} presupuesto`,
        detail: `${project.progressPercent}% del presupuesto de materiales comprometido.`,
        href: "/projects",
      });
    for (const requisition of requisitions
      .filter((item) => item.status === "pending")
      .slice(0, 2))
      alerts.push({
        id: `req-${requisition.id}`,
        severity: "info",
        source: "Inventario",
        title: `${requisition.code} pendiente`,
        detail: `Requisición para ${requisition.projectName} esperando despacho.`,
        href: "/inventory?tab=movements",
      });
    const weight: Record<AlertSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    return alerts
      .sort((a, b) => weight[a.severity] - weight[b.severity])
      .slice(0, 8);
  }, [
    quotes,
    commercialSummary.uncostedQuotes,
    criticalItems,
    projectStats,
    requisitions,
  ]);

  // Modales
  const [activeModal, setActiveModal] = useState<
    | "dispatch"
    | "project"
    | "requisition"
    | "return"
    | "tool"
    | "tool-return"
    | null
  >(null);
  const [selectedVoucherMovement, setSelectedVoucherMovement] =
    useState<InventoryMovement | null>(null);
  const [selectedToolLoan, setSelectedToolLoan] = useState<ToolLoan | null>(
    null,
  );

  // Form States
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(
    projects[0]?.id || "",
  );
  const [quantityInput, setQuantityInput] = useState("");
  const [responsibleInput, setResponsibleInput] = useState("Maestro de Obra");
  const [notesInput, setNotesInput] = useState("");
  const [workerNameInput, setWorkerNameInput] = useState("");
  // La herramienta se elige del inventario, no se escribe a mano: sin la
  // referencia a la existencia el trigger no podria descontar la unidad.
  const [toolStockId, setToolStockId] = useState("");
  const [toolLabelInput, setToolLabelInput] = useState("");
  const [toolExpectedReturn, setToolExpectedReturn] = useState("");
  const [toolReturnStatus, setToolReturnStatus] = useState<"returned" | "damaged">("returned");
  const [isSavingToolLoan, setIsSavingToolLoan] = useState(false);
  const [dispatchSignature, setDispatchSignature] = useState("");
  const [returnSignature, setReturnSignature] = useState("");
  const [toolSignature, setToolSignature] = useState("");
  const [toolReturnSignature, setToolReturnSignature] = useState("");
  const [toolReturnNotes, setToolReturnNotes] = useState("");

  // Requisición Form
  const [reqProject, setReqProject] = useState(projects[0]?.id || "");
  const [reqRequestedBy, setReqRequestedBy] = useState(
    "Carlos Restrepo (Maestro)",
  );
  const [reqNotes, setReqNotes] = useState("");

  // Toast notifications
  const [toasts, setToasts] = useState<
    Array<{ id: number; message: string; type: "success" | "warning" | "info" }>
  >([]);
  const showToast = (
    message: string,
    type: "success" | "warning" | "info" = "success",
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4500,
    );
  };

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const alphabetizedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        spanishCollator.compare(`${a.code} ${a.name}`, `${b.code} ${b.name}`),
      ),
    [projects],
  );

  // Handle New Dispatch (Salida a Obra)
  const handleDispatchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantityInput);
    if (!selectedProduct)
      return alert("Selecciona un material de la lista antes de continuar.");
    if (!qty || qty <= 0) return alert("Ingrese una cantidad válida.");
    if (!dispatchSignature)
      return alert("Captura la firma de quien recibe el material.");
    if (qty > selectedProduct.available)
      return alert(
        `Stock insuficiente. Solo hay ${selectedProduct.available} unidades.`,
      );

    const prj = projects.find((p) => p.id === selectedProjectId);
    const unitCost = selectedProduct.unitCost || 25000;
    const totalCost = qty * unitCost;

    const db = inventoryClient();
    if (!db || !scope || !prj) return alert("No fue posible validar la empresa y la obra del despacho.");
    const reference = `VALE-${new Date().getFullYear()}-${String(movements.length + 1).padStart(3, "0")}`;
    const { data: savedMovement, error } = await db.from("inventory_movements").insert({ stock_id: selectedProduct.id, company_id: scope.companyId, branch_id: scope.branchId, movement_type: "exit", quantity: qty, unit_cost: unitCost, reference, notes: notesInput || null, occurred_at: new Date().toISOString(), project_id: prj.id }).select("id").single();
    if (error || !savedMovement) return alert(error?.message ?? "No fue posible guardar el vale en la base de datos.");
    const newMovement: InventoryMovement = {
      id: savedMovement.id,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: "exit",
      quantity: qty,
      unit: selectedProduct.unit,
      unitCost,
      totalCost,
      occurredAt: formatDateTime(),
      reference,
      projectId: prj?.id,
      projectName: prj?.name,
      responsible: responsibleInput,
      notes: notesInput,
      signatureDataUrl: dispatchSignature,
    };

    setProducts((prev) =>
      prev.map((p) =>
        p.id === selectedProduct.id
          ? { ...p, available: p.available - qty }
          : p,
      ),
    );
    setMovements((prev) => [newMovement, ...prev]);

    setSelectedVoucherMovement(newMovement);
    setActiveModal(null);
    setQuantityInput("");
    setNotesInput("");
    setDispatchSignature("");
  };

  // Handle Devolución de Sobrante
  const handleReturnSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantityInput);
    if (!selectedProduct)
      return alert("Selecciona un material de la lista antes de continuar.");
    if (!qty || qty <= 0) return alert("Ingrese una cantidad válida.");
    if (!returnSignature)
      return alert("Captura la firma de quien devuelve el material.");

    const prj = projects.find((p) => p.id === selectedProjectId);
    const unitCost = selectedProduct.unitCost || 25000;
    const totalCost = qty * unitCost;

    const db = inventoryClient();
    if (!db || !scope) return alert("No fue posible validar la empresa para la devolución.");
    const reference = `DEV-${new Date().getFullYear()}-${String(movements.length + 1).padStart(3, "0")}`;
    const { data: savedMovement, error } = await db.from("inventory_movements").insert({ stock_id: selectedProduct.id, company_id: scope.companyId, branch_id: scope.branchId, movement_type: "entry", quantity: qty, unit_cost: unitCost, reference, notes: `Devolución sobrante de obra: ${notesInput}`, occurred_at: new Date().toISOString(), project_id: prj?.id ?? null }).select("id").single();
    if (error || !savedMovement) return alert(error?.message ?? "No fue posible guardar la devolución en la base de datos.");
    const newMovement: InventoryMovement = {
      id: savedMovement.id,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: "return",
      quantity: qty,
      unit: selectedProduct.unit,
      unitCost,
      totalCost,
      occurredAt: formatDateTime(),
      reference,
      projectId: prj?.id,
      projectName: prj?.name,
      responsible: responsibleInput,
      notes: `Devolución sobrante de obra: ${notesInput}`,
      signatureDataUrl: returnSignature,
    };

    setProducts((prev) =>
      prev.map((p) =>
        p.id === selectedProduct.id
          ? { ...p, available: p.available + qty }
          : p,
      ),
    );
    setMovements((prev) => [newMovement, ...prev]);

    setActiveModal(null);
    setQuantityInput("");
    setNotesInput("");
    setReturnSignature("");
    showToast(
      "Devolución registrada. Se incrementó el stock y se descontó el costo de la obra.",
      "success",
    );
  };

  // Handle Nueva Requisición
  const handleRequisitionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct)
      return alert("Selecciona un material de la lista antes de continuar.");
    const prj = projects.find((p) => p.id === reqProject);
    if (!prj) return alert("Selecciona una obra válida para la requisición.");
    const db = inventoryClient();
    if (!db) return alert("No fue posible conectar con la base de datos.");
    const quantity = parseFloat(quantityInput) || 10;
    const { data: savedReq, error } = await db.rpc("create_inventory_requisition", { target_project: prj.id, requester_name: reqRequestedBy, target_needed_by: null, request_notes: reqNotes || null, request_lines: [{ stock_id: selectedProduct.id, quantity }] });
    if (error || !savedReq?.[0]) return alert(error?.message ?? "No fue posible guardar la requisición en la base de datos.");
    const newReq: MaterialRequisition = {
      id: savedReq[0].requisition_id,
      code: savedReq[0].requisition_code,
      projectId: prj.id,
      projectName: prj?.name || "Obra General",
      requestedBy: reqRequestedBy,
      status: "pending",
      createdAt: formatDateTime(),
      notes: reqNotes,
      items: [
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity,
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
  /**
   * Despacha una requisición aprobada.
   *
   * Antes esto solo cambiaba el estado del navegador: fabricaba el movimiento con
   * un id local, restaba el stock a mano y abría la remisión. El papel salía pero
   * en la base el material nunca salía de la bodega. Ahora llama a la función
   * `dispatch_inventory_requisition`, que genera el movimiento, deja que el
   * trigger descuente la existencia y marca la requisición, todo en una sola
   * transacción: o pasa todo, o no pasa nada.
   *
   * La remision se arma con los datos que devuelve la base, no con los que
   * suponia el navegador, para que el vale impreso y la existencia digan lo mismo.
   */
  const [dispatchingRequisitionId, setDispatchingRequisitionId] = useState<string | null>(null);

  const handleApproveRequisition = async (req: MaterialRequisition) => {
    // Un clic de mas no debe intentar despachar dos veces la misma requisicion.
    if (dispatchingRequisitionId) return;
    setDispatchingRequisitionId(req.id);
    const item = req.items[0];
    if (!item) return;
    const db = inventoryClient();
    if (!db) {
      setDispatchingRequisitionId(null);
      return alert("No fue posible conectar con la base de datos para despachar.");
    }

    const { data, error } = await db.rpc("dispatch_inventory_requisition", {
      target_requisition: req.id,
      dispatch_notes: notesInput.trim() || null,
    });

    if (error) {
      setDispatchingRequisitionId(null);
      return alert(error.message);
    }

    // Tras despachar se relee el estado real: no se supone lo que paso.
    const { data: movedStock } = await db
      .from("inventory_movements")
      .select("id, stock_id, quantity, unit_cost, project_id, occurred_at")
      .eq("reference", `VALE-${req.code}`)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!movedStock) {
      setRequisitions((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: "dispatched" } : r)),
      );
      setDispatchingRequisitionId(null);
      showToast("Material despachado.", "success");
      return;
    }

    const newMov: InventoryMovement = {
      id: movedStock.id,
      productId: movedStock.stock_id,
      productName: item.productName,
      type: "exit",
      quantity: Number(movedStock.quantity),
      unit: item.unit,
      unitCost: Number(movedStock.unit_cost ?? item.unitCost),
      totalCost: Number(movedStock.quantity) * Number(movedStock.unit_cost ?? item.unitCost),
      occurredAt: formatDateTime(movedStock.occurred_at),
      reference: `VALE-${req.code}`,
      projectId: req.projectId,
      projectName: req.projectName,
      responsible: req.requestedBy,
      notes: `Despachado desde Requisición ${req.code}. ${req.notes || ""}`,
    };

    // El stock ya lo desconto la base de datos; aqui solo se refleja lo que paso.
    setProducts((prev) =>
      prev.map((p) =>
        p.id === movedStock.stock_id
          ? { ...p, available: p.available - Number(movedStock.quantity) }
          : p,
      ),
    );
    setMovements((prev) => [newMov, ...prev]);
    setRequisitions((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: "dispatched" } : r)),
    );
    setSelectedVoucherMovement(newMov);
    setDispatchingRequisitionId(null);
  };

  // Préstamo de Herramienta
  /**
   * Registra el préstamo en la base de datos.
   *
   * Antes se fabricaba el préstamo entero en el navegador: id, código y
   * referencia de herramienta inventados, y un mensaje de "registrado
   * correctamente" sin que se escribiera nada. Además la herramienta se escribía
   * como texto suelto, sin referencia a la existencia, así que no había forma de
   * descontar la unidad correcta.
   *
   * Ahora la herramienta se elige del inventario y el préstamo lo crea la función
   * create_tool_loan, que genera el código, guarda la firma de entrega y deja que
   * el trigger descuente la unidad. Aquí no se resta disponibilidad: eso es
   * trabajo de la base de datos, y hacerlo aquí descontaría doble.
   */
  const handleToolLoanSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSavingToolLoan) return;
    const db = inventoryClient();
    if (!db) return alert("No fue posible conectar con la base de datos para prestar.");
    if (!workerNameInput.trim())
      return alert("Ingrese el nombre de quien recibe la herramienta.");
    if (!toolStockId)
      return alert("Seleccione la herramienta que se va a entregar.");
    if (!toolSignature)
      return alert("Captura la firma de quien recibe la herramienta.");
    if (!selectedProjectId)
      return alert("Seleccione la obra a la que se asigna la herramienta.");

    setIsSavingToolLoan(true);
    try {
      const { data, error } = await db.rpc("create_tool_loan", {
        target_project: selectedProjectId,
        target_stock: toolStockId,
        receiver_name: workerNameInput.trim(),
        target_expected_return: toolExpectedReturn || null,
        loan_notes: notesInput.trim() || null,
        delivery_signature: toolSignature,
      });

      if (error) {
        alert(error.message);
        return;
      }

      const saved = Array.isArray(data) ? data[0] : data;
      setToolLoans((prev) => [
        {
          id: saved.loan_id,
          code: saved.loan_code,
          toolId: toolStockId,
          toolName: toolLabelInput,
          workerName: workerNameInput.trim(),
          projectId: selectedProjectId,
          projectName:
            projects.find((pr) => pr.id === selectedProjectId)?.name ?? "Obra sin nombre",
          loanDate: new Date().toISOString().slice(0, 10),
          expectedReturnDate: toolExpectedReturn || undefined,
          status: "active",
          notes: notesInput.trim() || undefined,
          deliverySignatureDataUrl: toolSignature,
        },
        ...prev,
      ]);

      setActiveModal(null);
      setWorkerNameInput("");
      setNotesInput("");
      setToolSignature("");
      setToolStockId("");
      setToolLabelInput("");
      setToolExpectedReturn("");
      showToast("Préstamo de herramienta registrado.", "success");
    } finally {
      setIsSavingToolLoan(false);
    }
  };

  // Registrar devolución de herramienta
  const openToolReturnModal = (loan: ToolLoan) => {
    setSelectedToolLoan(loan);
    setToolReturnSignature(loan.returnSignatureDataUrl ?? "");
    setToolReturnNotes("");
    setActiveModal("tool-return");
  };

  /**
   * Registra la devolución en la base de datos.
   *
   * Antes solo cambiaba el estado en memoria y mostraba "registrada
   * correctamente" sin escribir nada. Ahora llama a return_tool_loan, que valida
   * que el préstamo siga activo y guarda la firma de devolución. La unidad vuelve
   * a bodega por el trigger, no por un más uno escrito aquí.
   */
  const handleReturnToolLoan = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedToolLoan || isSavingToolLoan) return;
    if (!toolReturnSignature)
      return alert("Captura la firma de quien entrega la herramienta.");

    const db = inventoryClient();
    if (!db) return alert("No fue posible conectar con la base de datos para devolver.");

    setIsSavingToolLoan(true);
    try {
      const { error } = await db.rpc("return_tool_loan", {
        target_loan: selectedToolLoan.id,
        return_notes: toolReturnNotes.trim() || null,
        return_signature: toolReturnSignature,
        final_status: toolReturnStatus,
      });

      if (error) {
        alert(error.message);
        return;
      }

      setToolLoans((prev) =>
        prev.map((l) =>
          l.id === selectedToolLoan.id
            ? {
                ...l,
                status: toolReturnStatus,
                actualReturnDate: new Date().toISOString().slice(0, 10),
                returnSignatureDataUrl: toolReturnSignature,
                notes: [l.notes, toolReturnNotes.trim()]
                  .filter(Boolean)
                  .join("\nDevolución: "),
              }
            : l,
        ),
      );
      setActiveModal(null);
      setSelectedToolLoan(null);
      setToolReturnSignature("");
      setToolReturnNotes("");
      showToast("Devolución de herramienta registrada.", "success");
    } finally {
      setIsSavingToolLoan(false);
    }
  };

  return (
    <main
      className="dashboard-content dashboard-v3"
      id="main-content"
      tabIndex={-1}
    >
      {/* Contextual Greeting & Activity Summary */}
      <section className="dashboard-heading greeting-section">
        <div>
          <p className="greeting-date">{todayFormatted}</p>
          <h1>{greeting}, {viewerName}</h1>
          <div className="greeting-activity">
            <span className="activity-pill pill-dispatches">
              📤 {activitySummary.totalDispatches} despachos
            </span>
            <span className="activity-pill pill-entries">
              📥 {activitySummary.totalEntries} entradas
            </span>
            <span className="activity-pill pill-reqs">
              {globalFinancials.pendingReqsCount > 0
                ? `🟡 ${globalFinancials.pendingReqsCount} requisiciones pendientes`
                : "✅ Sin requisiciones pendientes"}
            </span>
            {activitySummary.activeTools > 0 && (
              <span className="activity-pill pill-tools">
                🛠️ {activitySummary.activeTools} herramientas en obra
              </span>
            )}
          </div>
        </div>
        <div className="dash-quick-btns">
          <button
            className="inventory-action btn-primary-action"
            onClick={() => setActiveModal("dispatch")}
          >
            📤 Nuevo Vale de Salida
          </button>
          <button
            className="inventory-action btn-secondary-action"
            onClick={() => setActiveModal("requisition")}
          >
            📝 Solicitud de Obra
          </button>
        </div>
      </section>

      {/* KPI Financial Cards */}
      <section
        className="dashboard-stat-grid exec-stat-grid"
        aria-label="Indicadores financieros consolidados"
        hidden={!canViewFinancials}
      >
        <article className="stat-card">
          <span>Presupuesto Obras ($ COP)</span>
          <strong>
            {currencyFormatter.format(globalFinancials.totalBudget)}
          </strong>
          <small>
            {globalFinancials.activeProjectsCount} obras activas contratadas
          </small>
        </article>

        <article className="stat-card card-spent">
          <span>Gasto Real Materiales</span>
          <strong className="text-spent">
            {currencyFormatter.format(globalFinancials.totalSpent)}
          </strong>
          <small>
            {globalFinancials.globalPercent}% del presupuesto total despachado
          </small>
        </article>

        <article className="stat-card card-remaining">
          <span>Saldo Disponible Obras</span>
          <strong className="text-remaining">
            {currencyFormatter.format(globalFinancials.totalRemaining)}
          </strong>
          <small>Fondo para consumo de materiales</small>
        </article>

        <article className="stat-card card-alerts">
          <span>Alertas de Operación</span>
          <strong>
            {globalFinancials.criticalStockCount +
              globalFinancials.pendingReqsCount}
          </strong>
          <small>
            {globalFinancials.criticalStockCount} ítems bajo mínimo ·{" "}
            {globalFinancials.pendingReqsCount} requisiciones pendientes
          </small>
        </article>
      </section>

      <section
        className="operational-alerts"
        id="operational-alerts"
        aria-labelledby="operational-alerts-title"
      >
        <div className="operational-alerts-heading">
          <div>
            <p>Centro de atención</p>
            <h2 id="operational-alerts-title">Alertas operativas</h2>
          </div>
          <span role="status" aria-atomic="true">
            {operationalAlerts.length} alerta
            {operationalAlerts.length === 1 ? "" : "s"} activa
            {operationalAlerts.length === 1 ? "" : "s"}
          </span>
        </div>
        {operationalAlerts.length ? (
          <div className="operational-alert-list">
            {operationalAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className={`operational-alert is-${alert.severity}`}
              >
                <span className="operational-alert-origin">
                  <AlertSourceIcon source={alert.source} />
                  <span>{alert.source}</span>
                </span>
                <span className="operational-alert-copy">
                  <strong>{alert.title}</strong>
                  <small>{alert.detail}</small>
                </span>
                <span className="operational-alert-action">
                  Ver <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="operational-alert-empty">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Sin alertas críticas ni pendientes operativos.</strong>
              <small>La operación se encuentra al día.</small>
            </div>
          </div>
        )}
      </section>

      <section
        className="dashboard-module-overview"
        aria-label="Resumen de cotizaciones, APU y obras"
        hidden={!canViewQuotes && !canViewApu && !canViewProjects}
      >
        <div className="module-overview-heading">
          <div>
            <p>Resumen integral</p>
            <h2>Comercial, costos y ejecución</h2>
          </div>
          <small>Actualizado al abrir el dashboard</small>
        </div>
        <div className="module-overview-grid">
          <article className="module-overview-card is-quotes" hidden={!canViewQuotes}>
            <div>
              <span className="module-overview-kicker">Cotizaciones</span>
              <strong>{commercialSummary.inProgress.length}</strong>
              <p>en proceso de costeo</p>
            </div>
            <small>
              {commercialSummary.pendingReview.length} por revisar ·{" "}
              {commercialSummary.uncostedQuotes.length} sin APU
            </small>
            <Link href="/quotes">Abrir cotizaciones →</Link>
          </article>
          <article className="module-overview-card is-apu" hidden={!canViewApu}>
            <div>
              <span className="module-overview-kicker">APU</span>
              <strong>{apus.length}</strong>
              <p>análisis registrados</p>
            </div>
            <small>
              {commercialSummary.linkedApus.length} vinculados a cotizaciones
            </small>
            <Link href="/apu">Gestionar APUs →</Link>
          </article>
          <article className="module-overview-card is-projects">
            <div>
              <span className="module-overview-kicker">Obras</span>
              <strong>{globalFinancials.activeProjectsCount}</strong>
              <p>frentes activos</p>
            </div>
            <small>
              {commercialSummary.confirmed.length} cotizaciones confirmadas ·{" "}
              {currencyFormatter.format(commercialSummary.confirmedValue)}
            </small>
            <Link href="/projects">Ver obras →</Link>
          </article>
        </div>
        {commercialSummary.uncostedQuotes.length > 0 ? (
          <div className="module-overview-action">
            <span>
              Atención:{" "}
              <strong>{commercialSummary.uncostedQuotes[0].code}</strong> está
              en cotización en proceso y aún no tiene APU.
            </span>
            <Link
              href={`/apu?quoteId=${encodeURIComponent(commercialSummary.uncostedQuotes[0].id)}&quoteCode=${encodeURIComponent(commercialSummary.uncostedQuotes[0].code)}&quoteTitle=${encodeURIComponent(commercialSummary.uncostedQuotes[0].title)}`}
            >
              Crear APU →
            </Link>
          </div>
        ) : null}
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
          <button
            className="tb-btn"
            onClick={() => setActiveModal("requisition")}
          >
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
          <span className="dashboard-data-badge">
            Valorización en Vivo ($ COP)
          </span>
        </div>

        <div className="projects-grid">
          {projectStats.map((prj) => (
            <article
              className={`project-card status-${prj.statusColor}`}
              key={prj.id}
            >
              <div className="prj-card-header">
                <div>
                  <span className="prj-code">{prj.code}</span>
                  <h3>{prj.name}</h3>
                  <small>
                    Cliente: {prj.client} · {prj.location}
                  </small>
                </div>
                <span className={`prj-badge badge-${prj.statusColor}`}>
                  {prj.progressPercent >= 100
                    ? "🔴 Sobrecosto"
                    : prj.progressPercent >= 80
                      ? "🟡 Alerta Stock"
                      : "🟢 Normal"}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="prj-progress-box">
                <div className="prj-progress-labels">
                  <span>Avance Presupuestal</span>
                  <strong>{prj.progressPercent}% Ejecutado</strong>
                </div>
                <div className="prj-bar-track">
                  <div
                    className={`prj-bar-fill fill-${prj.statusColor}`}
                    style={{ width: `${prj.progressPercent}%` }}
                  />
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
                  <strong
                    className={
                      prj.remaining < 0 ? "text-danger" : "text-success"
                    }
                  >
                    {currencyFormatter.format(prj.remaining)}
                  </strong>
                </div>
              </div>

              {/* Recent Materials */}
              {prj.recentMovements.length > 0 && (
                <div className="prj-recent-items">
                  <small className="recent-title">
                    Últimos insumos despachados:
                  </small>
                  <ul>
                    {prj.recentMovements.map((m) => (
                      <li key={m.id}>
                        <span>
                          {m.productName} ({m.quantity} {m.unit})
                        </span>
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
            <p className="panel-intro">
              Registre despachos para ver el ranking de costos de materiales.
            </p>
          ) : (
            <div className="top-materials-list">
              {topMaterials.map((mat, idx) => (
                <div className="top-mat-row" key={mat.id}>
                  <span className="top-rank">#{idx + 1}</span>
                  <div className="top-mat-info">
                    <strong>{mat.name}</strong>
                    <small>
                      {numberFormatter.format(mat.qty)} {mat.unit} despachados
                    </small>
                  </div>
                  <div className="top-mat-cost">
                    <strong>{currencyFormatter.format(mat.total)}</strong>
                    <small>
                      {totalMaterialSpend > 0
                        ? Math.round((mat.total / totalMaterialSpend) * 100)
                        : 0}
                      % del gasto
                    </small>
                  </div>
                  <div className="top-mat-bar-track">
                    <div
                      className="top-mat-bar-fill"
                      style={{
                        width: `${(mat.total / topMaterialsMaxSpend) * 100}%`,
                      }}
                    />
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
                    <div
                      className={`chart-bar-fill fill-${prj.statusColor}`}
                      style={{ width: `${(prj.spent / maxSpent) * 100}%` }}
                    />
                  </div>
                  <span className="chart-value">
                    {currencyFormatter.format(prj.spent)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <i className="legend-dot dot-green" /> Normal (&lt;80%)
            </span>
            <span className="legend-item">
              <i className="legend-dot dot-yellow" /> Alerta (80-100%)
            </span>
            <span className="legend-item">
              <i className="legend-dot dot-red" /> Sobrecosto (&gt;100%)
            </span>
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
            <span className="critical-badge">
              {criticalItems.length} artículos requieren compra
            </span>
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
                    <small>
                      {item.category} · {item.brand}
                    </small>
                  </td>
                  <td>{item.inventoryGroupName}</td>
                  <td>
                    <strong
                      className={
                        item.available <= 0 ? "text-danger" : "text-warning"
                      }
                    >
                      {item.available} {item.unit}
                    </strong>
                  </td>
                  <td>
                    {item.minimum} {item.unit}
                  </td>
                  <td>
                    <strong className="text-danger">
                      {item.deficit} {item.unit}
                    </strong>
                  </td>
                  <td>
                    <span className="action-tag">
                      Comprar {item.deficit} {item.unit}
                    </span>
                  </td>
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
            <span className="req-count-badge">
              {globalFinancials.pendingReqsCount} Pendientes
            </span>
          </div>
          <p className="panel-intro">
            Solicitudes de insumos enviadas por los maestros o residentes de
            obra pendientes de despacho.
          </p>

          <div className="requisitions-list">
            {requisitions.length === 0 ? (
              <p className="empty-text">No hay requisiciones registradas.</p>
            ) : (
              requisitions.map((req) => (
                <div className={`req-item status-${req.status}`} key={req.id}>
                  <div className="req-info">
                    <div className="req-header">
                      <strong>
                        {req.code} · {req.projectName}
                      </strong>
                      <span className={`status-pill pill-${req.status}`}>
                        {req.status === "pending"
                          ? "🟡 Pendiente"
                          : req.status === "dispatched"
                            ? "🟢 Despachado"
                            : req.status}
                      </span>
                    </div>
                    <small>
                      Solicitado por: {req.requestedBy} · Fecha: {req.createdAt}
                    </small>
                    <div className="req-products">
                      {req.items.map((it, idx) => (
                        <span key={idx}>
                          • {it.productName}:{" "}
                          <strong>
                            {it.quantity} {it.unit}
                          </strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <button
                      className="btn-approve-req"
                      disabled={dispatchingRequisitionId !== null}
                      onClick={() => void handleApproveRequisition(req)}
                    >
                      {dispatchingRequisitionId === req.id
                        ? "Despachando…"
                        : "⚡ Aprobar y Despachar"}
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
            <button
              className="btn-mini-add"
              onClick={() => setActiveModal("tool")}
            >
              + Prestar Herramienta
            </button>
          </div>
          <p className="panel-intro">
            Seguimiento a equipos mayores y herramientas entregadas a cuadrillas
            y trabajadores.
          </p>

          <div className="tool-loans-list">
            {toolLoans.map((loan) => (
              <div className={`loan-item status-${loan.status}`} key={loan.id}>
                <div>
                  <strong>🛠️ {loan.toolName}</strong>
                  <small>
                    Entregado a: <b>{loan.workerName}</b> ({loan.projectName})
                  </small>
                  <span className="loan-date">
                    Fecha salida: {loan.loanDate}
                  </span>
                </div>
                {loan.status === "active" ? (
                  <button
                    className="btn-return-tool"
                    onClick={() => openToolReturnModal(loan)}
                    type="button"
                  >
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
                    {mov.type === "exit"
                      ? "Salida Obra"
                      : mov.type === "entry"
                        ? "Entrada Bodega"
                        : mov.type === "return"
                          ? "Devolución"
                          : "Ajuste"}
                  </span>
                </td>
                <td>
                  <strong>{mov.productName}</strong>
                  {mov.responsible && <small>Resp: {mov.responsible}</small>}
                </td>
                <td>
                  {mov.quantity} {mov.unit}
                </td>
                <td>{currencyFormatter.format(mov.unitCost)}</td>
                <td>
                  <strong>{currencyFormatter.format(mov.totalCost)}</strong>
                </td>
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
                  formatDetail={(product) =>
                    `${product.sku} · ${currencyFormatter.format(product.unitCost || 25000)}`
                  }
                />
              </div>

              <div className="form-group">
                <label>Obra Destino (Imputación de Costo):</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
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
                    {currencyFormatter.format(
                      (parseFloat(quantityInput) || 0) *
                        (selectedProduct?.unitCost || 25000),
                    )}
                  </strong>
                </div>
              )}

              <SignatureCapture
                label="Capturar firma de recibido"
                value={dispatchSignature}
                onChange={setDispatchSignature}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setActiveModal(null)}
                >
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
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {alphabetizedProjects.map((prj) => (
                    <option key={prj.id} value={prj.id}>
                      {prj.code} - {prj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Material Devuelto a Bodega:</label>
                <SearchableProductPicker
                  products={products}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                />
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

              <SignatureCapture
                label="Capturar firma de devolución"
                value={returnSignature}
                onChange={setReturnSignature}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setActiveModal(null)}
                >
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
                <select
                  value={reqProject}
                  onChange={(e) => setReqProject(e.target.value)}
                >
                  {alphabetizedProjects.map((prj) => (
                    <option key={prj.id} value={prj.id}>
                      {prj.code} - {prj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Insumo Requerido:</label>
                <SearchableProductPicker
                  products={products}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                />
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
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setActiveModal(null)}
                >
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
                {/* Se elige del inventario, no se escribe el nombre a mano. Es lo
                    que permite que el descuento de la unidad sea real. */}
                <SearchableProductPicker
                  products={products}
                  value={toolStockId}
                  onChange={(stockId) => {
                    setToolStockId(stockId);
                    setToolLabelInput(
                      products.find((item) => item.id === stockId)?.name ?? "",
                    );
                  }}
                  formatDetail={(item) =>
                    `${item.sku ?? "Sin sku"} · Disponible: ${item.available} ${item.unit ?? "und"}`
                  }
                />
              </div>

              <div className="form-group">
                <label>Fecha esperada de devolución (opcional):</label>
                <input
                  type="date"
                  value={toolExpectedReturn}
                  onChange={(e) => setToolExpectedReturn(e.target.value)}
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
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {alphabetizedProjects.map((prj) => (
                    <option key={prj.id} value={prj.id}>
                      {prj.code} - {prj.name}
                    </option>
                  ))}
                </select>
              </div>

              <SignatureCapture
                label="Capturar firma de recibido"
                value={toolSignature}
                onChange={setToolSignature}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setActiveModal(null)}
                >
                  Cancelar
                </button>
                <button disabled={isSavingToolLoan} type="submit" className="btn-submit">
                  {isSavingToolLoan ? "Guardando…" : "Confirmar Préstamo de Herramienta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Devolución de herramienta */}
      {activeModal === "tool-return" && selectedToolLoan && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tool-return-title"
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="tool-return-title">Registrar devolución de herramienta</h2>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedToolLoan(null);
                }}
                aria-label="Cerrar registro de devolución"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleReturnToolLoan}>
              <section className="tool-return-summary" aria-label="Préstamo a devolver">
                <span className="tool-return-summary-label">Préstamo activo</span>
                <strong>{selectedToolLoan.toolName}</strong>
                <p>
                  Entregada a {selectedToolLoan.workerName} · {selectedToolLoan.projectName}
                </p>
                <small>Salida: {selectedToolLoan.loanDate}</small>
              </section>

              <div className="form-group">
                <label htmlFor="tool-return-status">¿Cómo se recibe la herramienta?</label>
                {/* El estado no es solo un color: dice con palabras qué pasó con la
                    unidad, porque una dañada no vuelve a estar disponible. */}
                <select
                  id="tool-return-status"
                  value={toolReturnStatus}
                  onChange={(e) => setToolReturnStatus(e.target.value as "returned" | "damaged")}
                >
                  <option value="returned">Devuelta en buen estado</option>
                  <option value="damaged">Devuelta dañada</option>
                </select>
                {toolReturnStatus === "damaged" ? (
                  <p className="form-hint">
                    Una herramienta dañada queda fuera de la bodega y no vuelve a estar
                    disponible hasta que se registre su baja.
                  </p>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="tool-return-notes">Estado y observaciones de devolución</label>
                <textarea
                  id="tool-return-notes"
                  value={toolReturnNotes}
                  onChange={(e) => setToolReturnNotes(e.target.value)}
                  placeholder="Ej.: recibida completa, limpieza pendiente o novedad encontrada"
                  rows={3}
                />
              </div>

              <SignatureCapture
                label="Capturar firma de quien entrega"
                value={toolReturnSignature}
                onChange={setToolReturnSignature}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedToolLoan(null);
                  }}
                >
                  Cancelar
                </button>
                <button disabled={isSavingToolLoan} type="submit" className="btn-submit">
                  {isSavingToolLoan ? "Guardando…" : "Confirmar devolución"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VOUCHER IMPRIMIBLE */}
      <PrintableDispatchVoucher
        movement={selectedVoucherMovement}
        project={projects.find(
          (p) => p.id === selectedVoucherMovement?.projectId,
        )}
        onClose={() => setSelectedVoucherMovement(null)}
      />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item toast-${t.type}`}>
              <span className="toast-icon">
                {t.type === "success"
                  ? "✅"
                  : t.type === "warning"
                    ? "⚠️"
                    : "ℹ️"}
              </span>
              <p>{t.message}</p>
              <button
                className="toast-dismiss"
                onClick={() =>
                  setToasts((prev) => prev.filter((x) => x.id !== t.id))
                }
                type="button"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
