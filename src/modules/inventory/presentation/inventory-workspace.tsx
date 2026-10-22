"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  getInventoryItemKind,
  type StockProduct,
  type Project,
  type InventoryMovement,
  type MovementType,
  inventoryUnits,
  matchesInventorySearch,
  withDefaultInventoryAliases,
} from "../index";
import { InlineCatalogCombobox } from "./inline-catalog-combobox";
import { InventoryIcon } from "./inventory-icons";
import { WriteoffsPanel } from "./writeoffs-panel";
import { CurrencyInput } from "@/shared/components/currency-input";
import { loadAllPages } from "@/shared/supabase/load-all";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO");
const spanishCollator = new Intl.Collator("es-CO", { numeric: true, sensitivity: "base" });

const movementLabels: Record<MovementType, string> = {
  entry: "Entrada a Bodega",
  exit: "Salida para Obra",
  adjustment: "Ajuste de Inventario",
  return: "Devolución a Bodega",
  transfer: "Traslado de Ubicación",
};

const movementOperationLabels: Record<string, string> = {
  adjustment: "Ajuste",
  dispatch: "Despacho",
  entry: "Entrada",
  exit: "Salida",
  loan: "Préstamo",
  return: "Devolución",
  transfer: "Traslado",
};

type TabKey = "catalog" | "movements" | "projects" | "low-stock" | "writeoffs" | "settings";

function formatDateTime() {
  const date = new Date();
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Evita inyección de fórmulas al abrir el CSV en Excel y escapa comillas,
 * separadores y saltos de línea. Los valores numéricos se escriben sin
 * prefijo para no convertirlos en texto.
 */
function csvCell(value: string | number | null | undefined, numeric = false) {
  if (value === null || value === undefined) return '""';
  if (numeric) return String(value);
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
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
  // El estado visible se confirma contra Supabase; no se usa almacenamiento local.
  const [products, setProducts] = useState<StockProduct[]>(() => withDefaultInventoryAliases(initialProducts ?? []));
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scope, setScope] = useState<{ companyId: string; branchId: string } | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const supabase = useMemo(() => isSupabaseConfigured && supabaseUrl && supabasePublishableKey ? createBrowserClient(supabaseUrl, supabasePublishableKey) : null, []);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: membership } = await supabase.from("user_roles").select("company_id, branch_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
      if (!membership?.company_id || !membership.branch_id) return;
      setScope({ companyId: membership.company_id, branchId: membership.branch_id });
      const [projectResult, movementResult, categoryResult, locationResult] = await Promise.all([
        supabase.from("projects").select("id, code, name, client, location, material_budget, status, start_date, estimated_end_date, actual_end_date, created_at").eq("company_id", membership.company_id).order("created_at", { ascending: false }),
        loadAllPages((from, to) =>
          supabase
            .from("inventory_movements")
            .select("id, stock_id, movement_type, operation_kind, quantity, quantity_before, quantity_after, unit_cost, reference, notes, responsible_name, occurred_at, project_id, inventory_stock!inner(inventory_items!inner(name, unit)), projects(name)")
            .eq("company_id", membership.company_id)
            .order("occurred_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to),
        ),
        supabase.from("inventory_categories").select("name").eq("company_id", membership.company_id).eq("is_active", true).order("name"),
        supabase.from("inventory_locations").select("warehouse, aisle, shelf, level, bin").eq("company_id", membership.company_id).eq("branch_id", membership.branch_id).eq("is_active", true).order("warehouse"),
      ]);
      if (projectResult.data) setProjects(projectResult.data.map((project) => ({ id: project.id, code: project.code, name: project.name, client: project.client, location: project.location ?? "Sin ubicación", budget: Number(project.material_budget), status: project.status as Project["status"], createdAt: project.created_at, startDate: project.start_date, estimatedEndDate: project.estimated_end_date, actualEndDate: project.actual_end_date, type: project.code.startsWith("MANT-") ? "mantenimiento" : project.code.startsWith("OBRA-") ? "obra" : "otro" })));
      if (movementResult.error) {
        showToast("No fue posible cargar todos los movimientos del kardex.", "error");
      } else {
        setMovements(movementResult.data.map((movement) => {
          const stock = Array.isArray(movement.inventory_stock) ? movement.inventory_stock[0] : movement.inventory_stock;
          const item = stock && (Array.isArray(stock.inventory_items) ? stock.inventory_items[0] : stock.inventory_items);
          const project = Array.isArray(movement.projects) ? movement.projects[0] : movement.projects;
          const type: MovementType = movement.movement_type === "entry"
            ? (movement.operation_kind === "return" ? "return" : "entry")
            : movement.movement_type === "exit"
              ? "exit"
              : movement.movement_type === "transfer"
                ? "transfer"
                : "adjustment";
          return { id: movement.id, productId: movement.stock_id, productName: item?.name, type, quantity: Number(movement.quantity), unit: item?.unit, unitCost: Number(movement.unit_cost), totalCost: Number(movement.quantity) * Number(movement.unit_cost), occurredAt: new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(movement.occurred_at)), reference: movement.reference, projectId: movement.project_id ?? undefined, projectName: project?.name, responsible: movement.responsible_name ?? undefined, notes: movement.notes ?? undefined, operationKind: movement.operation_kind ?? undefined, quantityBefore: movement.quantity_before === null ? null : Number(movement.quantity_before), quantityAfter: movement.quantity_after === null ? null : Number(movement.quantity_after) };
        }));
      }
      if (categoryResult.data) setCustomCategories(categoryResult.data.map((category) => category.name));
      if (locationResult.data) setCustomLocations(locationResult.data.map((location) => [location.warehouse, location.aisle, location.shelf, location.level, location.bin].filter(Boolean).join(" · ")));
    })();
  }, [supabase]);

  // Estados de navegación e interfaz
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [itemKindFilter, setItemKindFilter] = useState<"all" | "material" | "tool" | "equipment" | "ppe">("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");
  const [movementProjectFilter, setMovementProjectFilter] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const movementPageSize = 50;
  const [isSavingMovement, setIsSavingMovement] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [customBrands, setCustomBrands] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newLocationName, setNewLocationName] = useState("");

  // Estados del modal de movimientos
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [movementType, setMovementType] = useState<MovementType>("exit");
  const [adjustmentDirection, setAdjustmentDirection] = useState<"increase" | "decrease">("increase");
  const [quantityInput, setQuantityInput] = useState<string>("1");
  const [unitCostInput, setUnitCostInput] = useState<string>("");
  const [referenceInput, setReferenceInput] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [responsibleInput, setResponsibleInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", sku: "", aliases: "", category: "", brand: "", unit: "", purchaseUnit: "", unitsPerPurchase: "", location: "", warehouse: "", aisle: "", shelf: "", level: "", bin: "", group: "bodega" as StockProduct["inventoryGroup"], quantity: "", cost: "", minimum: "", assetType: "material", model: "", technicalReference: "", serialNumber: "", acquiredAt: "", warrantyUntil: "", assetCondition: "available" as const });

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
    // Un costo cero o pendiente no se reemplaza por un valor inventado.
    () => products.reduce((sum, p) => sum + p.available * (p.unitCost ?? 0), 0),
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

  const categoryOptions = useMemo(() => [...new Set(["Insumo", ...customCategories, ...products.map((product) => product.category)])], [customCategories, products]);
  const unitOptions = useMemo(() => [...new Set([...customUnits, ...inventoryUnits.map((unit) => unit.symbol), ...products.map((product) => product.unit)])], [customUnits, products]);
  const brandOptions = useMemo(() => [...new Set(["Sin marca", ...customBrands, ...products.map((product) => product.brand)])], [customBrands, products]);
  const locationOptions = useMemo(() => [...new Set([...customLocations, ...products.map((product) => product.location)])], [customLocations, products]);
  const catalogSearchResults = useMemo(() => {
    if (!query.trim()) return [];
    return products
      .filter((product) => matchesInventorySearch(product, query))
      .sort((a, b) => spanishCollator.compare(a.name, b.name))
      .slice(0, 8);
  }, [products, query]);

  // Filtrado de productos del catálogo
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (groupFilter !== "all" && p.inventoryGroup !== groupFilter) return false;
      if (itemKindFilter !== "all" && getInventoryItemKind(p) !== itemKindFilter) return false;
      if (locationFilter !== "all" && p.location !== locationFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (stockFilter === "low" && (p.minimum === null || p.available > p.minimum)) return false;
      if (stockFilter === "out" && p.available > 0) return false;
      if (stockFilter === "available" && p.available <= 0) return false;
      return matchesInventorySearch(p, query);
    }).sort((a, b) => spanishCollator.compare(a.name, b.name));
  }, [products, query, groupFilter, itemKindFilter, stockFilter, locationFilter, categoryFilter]);

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

  const movementTotalPages = Math.max(1, Math.ceil(filteredMovements.length / movementPageSize));
  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * movementPageSize;
    return filteredMovements.slice(start, start + movementPageSize);
  }, [filteredMovements, movementPage, movementPageSize]);

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

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name || !supabase || !scope) return;
    const { data, error } = await supabase.from("inventory_categories").insert({ company_id: scope.companyId, name }).select("name").single();
    if (error || !data) return showToast(error?.message ?? "No fue posible crear la categoría.", "error");
    setCustomCategories((current) => [...new Set([...current, data.name])]);
    setNewCategoryName("");
    showToast("Categoría creada en la base de datos.");
  }

  async function createLocation(event: FormEvent) {
    event.preventDefault();
    const value = newLocationName.trim();
    if (!value || !supabase || !scope) return;
    const parts = value.split("·").map((part) => part.trim()).filter(Boolean);
    const [warehouse, aisle, shelf, level, bin] = parts;
    if (!warehouse) return showToast("Indica al menos la bodega o ubicación principal.", "error");
    const { data, error } = await supabase.from("inventory_locations").upsert({ company_id: scope.companyId, branch_id: scope.branchId, warehouse, aisle: aisle ?? null, shelf: shelf ?? null, level: level ?? null, bin: bin ?? null }, { onConflict: "branch_id,warehouse,aisle,shelf,level,bin" }).select("warehouse, aisle, shelf, level, bin").single();
    if (error || !data) return showToast(error?.message ?? "No fue posible crear la ubicación.", "error");
    const label = [data.warehouse, data.aisle, data.shelf, data.level, data.bin].filter(Boolean).join(" · ");
    setCustomLocations((current) => [...new Set([...current, label])]);
    setNewLocationName("");
    showToast("Ubicación creada en la base de datos.");
  }

  // Abrir modal de movimiento con producto precargado
  function openMovementModal(product?: StockProduct, defaultType: MovementType = "exit") {
    const target = product;
    if (target) {
      setSelectedProductId(target.id);
      setModalSearch(target.name);
      setUnitCostInput((target.unitCost ?? 0) > 0 ? String(target.unitCost) : "");
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
    setUnitCostInput((p.unitCost ?? 0) > 0 ? String(p.unitCost) : "");
    setShowAutocomplete(false);
  }

  // Ejecutar registro de movimiento con validaciones
  async function handleSaveMovement(e: FormEvent) {
    e.preventDefault();
    if (isSavingMovement) return;
    setFormError(null);

    const qty = Number(quantityInput);
    const typedCost = unitCostInput.trim() === "" ? null : Number(unitCostInput);
    const ref = referenceInput.trim();

    if (!selectedProduct) {
      setFormError("Por favor selecciona un artículo válido.");
      return;
    }
    if (!qty || qty <= 0 || !Number.isFinite(qty)) {
      setFormError("La cantidad debe ser un número positivo mayor a cero.");
      return;
    }
    if (typedCost !== null && (!Number.isFinite(typedCost) || typedCost < 0)) {
      setFormError("El costo unitario debe ser un número mayor o igual a cero, o quedar vacío si aún no se conoce.");
      return;
    }
    if (!ref) {
      setFormError("Ingresa un número de documento, orden o vale de referencia.");
      return;
    }

    if (!supabase || !scope) {
      setFormError("No fue posible validar la empresa del usuario. Vuelve a iniciar sesión.");
      return;
    }
    const decreasesStock = movementType === "exit" || (movementType === "adjustment" && adjustmentDirection === "decrease");
    if (decreasesStock && selectedProduct.available - qty < 0) {
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

    const dbMovementType = movementType === "entry" || movementType === "return"
      ? "entry"
      : movementType === "exit"
        ? "exit"
        : adjustmentDirection === "increase"
          ? "adjustment_in"
          : "adjustment_out";
    const operationKind = movementType === "return"
      ? "return"
      : movementType === "entry"
        ? "entry"
        : movementType === "exit"
          ? "exit"
          : "adjustment";

    setIsSavingMovement(true);
    try {
      const { data, error } = await supabase.rpc("register_inventory_movement", {
        p_stock_id: selectedProduct.id,
        p_movement_type: dbMovementType,
        p_quantity: qty,
        p_unit_cost: typedCost,
        p_reference: ref,
        p_project_id: movementType === "exit" || movementType === "return" ? project?.id ?? null : null,
        p_responsible_name: responsibleInput.trim() || null,
        p_notes: notesInput.trim() || null,
        p_operation_kind: operationKind,
        p_client_request_id: crypto.randomUUID(),
      });
      if (error) {
        setFormError(error.message);
        return;
      }

      const saved = (Array.isArray(data) ? data[0] : data) as
        | { movement_id: string; quantity_before: number | null; quantity_after: number | null; unit_cost: number; occurred_at: string; operation_kind: string }
        | null;
      if (!saved) {
        setFormError("La base de datos no confirmó el movimiento. Recarga antes de reintentar.");
        return;
      }

      // La base calcula el costo promedio y el saldo. Se relee para que la
      // pantalla no muestre un costo distinto al que quedó registrado.
      const { data: stockRow } = await supabase
        .from("inventory_stock")
        .select("quantity,unit_cost")
        .eq("id", selectedProduct.id)
        .maybeSingle();
      const savedUnitCost = Number(saved.unit_cost);
      const totalCost = qty * savedUnitCost;
      const updatedQuantity = stockRow ? Number(stockRow.quantity) : Math.max(0, selectedProduct.available + (decreasesStock ? -qty : qty));
      const updatedCost = stockRow ? Number(stockRow.unit_cost) : selectedProduct.unitCost;

      const newMovement: InventoryMovement = {
        id: saved.movement_id,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: movementType,
        quantity: qty,
        unit: selectedProduct.unit,
        unitCost: savedUnitCost,
        totalCost,
        occurredAt: new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(saved.occurred_at)),
        reference: ref,
        projectId: movementType === "exit" || movementType === "return" ? project?.id : undefined,
        projectName: movementType === "exit" || movementType === "return" ? project?.name : undefined,
        responsible: responsibleInput.trim() || undefined,
        notes: notesInput.trim() || undefined,
        operationKind: saved.operation_kind,
        quantityBefore: saved.quantity_before === null ? null : Number(saved.quantity_before),
        quantityAfter: saved.quantity_after === null ? null : Number(saved.quantity_after),
      };

      setProducts((current) =>
        current.map((p) =>
          p.id === selectedProduct.id
            ? { ...p, available: updatedQuantity, unitCost: updatedCost }
            : p
        )
      );
      setMovements((current) => [newMovement, ...current]);
      setMovementPage(1);
      setIsMovementModalOpen(false);

      const msg =
        movementType === "exit"
          ? `Salida de ${qty} ${selectedProduct.unit} de "${selectedProduct.name}" registrada para ${project ? project.name : "obra"}. Costo: ${currencyFormatter.format(totalCost)}.`
          : movementType === "return"
            ? `Devolución de ${qty} ${selectedProduct.unit} de "${selectedProduct.name}" registrada.`
            : movementType === "entry"
              ? `Entrada de ${qty} ${selectedProduct.unit} agregada a bodega exitosamente.`
              : `Ajuste de inventario aplicado a "${selectedProduct.name}".`;

      showToast(msg, "success");
    } finally {
      setIsSavingMovement(false);
    }
  }

  // Crear nuevo proyecto / obra
  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectCode.trim()) {
      showToast("Completa el código y nombre de la obra.", "error");
      return;
    }

    if (!supabase || !scope) {
      showToast("No fue posible validar la empresa del usuario. Vuelve a iniciar sesión.", "error");
      return;
    }
    const currentDate = new Date().toISOString().slice(0, 10);
    const draftProject = {
      code: newProjectCode.trim().toUpperCase(),
      name: newProjectName.trim(),
      client: newProjectClient.trim() || "Representaciones Figueroa",
      location: newProjectLocation.trim() || "Caucasia, Antioquia",
      material_budget: Number(newProjectBudget) || 0,
      status: "active",
      company_id: scope.companyId,
      branch_id: scope.branchId,
      start_date: currentDate,
      estimated_end_date: currentDate,
    };
    const { data: savedProject, error } = await supabase.from("projects").insert(draftProject).select("id, created_at").single();
    if (error || !savedProject) {
      showToast(error?.message ?? "No fue posible guardar la obra en la base de datos.", "error");
      return;
    }
    const newPrj: Project = { id: savedProject.id, code: draftProject.code, type: draftProject.code.startsWith("MANT-") ? "mantenimiento" : draftProject.code.startsWith("OBRA-") ? "obra" : "otro", name: draftProject.name, client: draftProject.client, location: draftProject.location, budget: draftProject.material_budget, status: "active", createdAt: savedProject.created_at, startDate: currentDate, estimatedEndDate: currentDate };

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
  async function handleSaveMinimum(e: FormEvent) {
    e.preventDefault();
    if (!editingMinimumProduct) return;

    const parsedMin = newMinimumValue.trim() === "" ? null : Number(newMinimumValue);
    if (parsedMin !== null && (isNaN(parsedMin) || parsedMin < 0)) {
      showToast("Ingresa un valor válido o déjalo vacío.", "error");
      return;
    }

    if (!supabase) {
      showToast("No fue posible conectar con la base de datos.", "error");
      return;
    }
    const { error } = await supabase.rpc("update_inventory_minimum", {
      p_stock_id: editingMinimumProduct.id,
      p_minimum_quantity: parsedMin,
    });
    if (error) {
      showToast(error.message, "error");
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

  async function handleCreateItem(e: FormEvent) {
    e.preventDefault();
    const purchaseQuantity = Number(newItem.quantity);
    const unitsPerPurchase = Number(newItem.unitsPerPurchase);
    const purchaseUnitCost = Number(newItem.cost);
    if (!newItem.name.trim() || !purchaseQuantity || purchaseQuantity <= 0 || !unitsPerPurchase || unitsPerPurchase <= 0 || !Number.isFinite(purchaseUnitCost) || purchaseUnitCost < 0) {
      showToast("Indica una cantidad recibida, equivalencia y costo de compra válidos.", "error"); return;
    }
    const quantity = purchaseQuantity * unitsPerPurchase;
    const unitCost = purchaseUnitCost / unitsPerPurchase;
    if (!supabase || !scope) { showToast("No fue posible validar la empresa del usuario. Vuelve a iniciar sesión.", "error"); return; }
    const { data: stockId, error } = await supabase.rpc("create_inventory_item_with_opening_balance", {
      p_company_id: scope.companyId, p_branch_id: scope.branchId, p_sku: newItem.sku.trim() || null,
      p_name: newItem.name.trim(), p_category: newItem.category || null, p_brand: newItem.brand.trim() || null,
      p_unit: newItem.unit.trim(), p_notes: newItem.aliases.trim() || null, p_inventory_group: newItem.group,
      p_location: newItem.location.trim() || null, p_minimum_quantity: newItem.minimum === "" ? null : Number(newItem.minimum),
      p_unit_cost: unitCost, p_quantity: quantity, p_purchase_unit: newItem.purchaseUnit.trim() || null,
      p_units_per_purchase: unitsPerPurchase, p_purchase_unit_cost: purchaseUnitCost,
      p_technical_reference: newItem.technicalReference.trim() || null, p_model: newItem.model.trim() || null,
      p_serial_number: newItem.serialNumber.trim() || null, p_acquired_at: newItem.acquiredAt || null,
      p_warranty_until: newItem.warrantyUntil || null, p_asset_condition: newItem.assetType === "material" ? null : newItem.assetCondition,
    });
    if (error || !stockId) { showToast(error?.message ?? "No fue posible crear el artículo en la base de datos.", "error"); return; }
    const id = stockId;
    const location = newItem.location.trim();
    const aliases = [...new Set(newItem.aliases.split(",").map((alias) => alias.trim()).filter(Boolean))];
    const product: StockProduct = { id, sku: newItem.sku.trim() || `SKU-${Date.now()}`, name: newItem.name.trim(), aliases, category: newItem.category, brand: newItem.brand.trim() || "Sin marca", unit: newItem.unit.trim(), purchaseUnit: newItem.purchaseUnit.trim(), unitsPerPurchase, purchaseUnitCost, location, inventoryGroup: newItem.group, inventoryGroupName: newItem.group === "bodega" ? "Bodega" : newItem.group === "dotacion" ? "Dotación" : "Herramientas de trabajadores", available: quantity, minimum: newItem.minimum === "" ? null : Number(newItem.minimum), notes: null, active: true, unitCost, model: newItem.model.trim() || undefined, technicalReference: newItem.technicalReference.trim() || undefined, serialNumber: newItem.serialNumber.trim() || undefined, acquiredAt: newItem.acquiredAt || undefined, warrantyUntil: newItem.warrantyUntil || undefined, assetCondition: newItem.assetType === "material" ? undefined : newItem.assetCondition, sourceRow: 0 };
    const movement: InventoryMovement = { id: `mov-${Date.now()}`, productId: id, productName: product.name, type: "entry", quantity, unit: product.unit, unitCost, totalCost: quantity * unitCost, occurredAt: formatDateTime(), reference: `ING-${new Date().getFullYear()}-${String(movements.length + 1).padStart(3, "0")}`, notes: "Entrada inicial al crear artículo" };
    setProducts(current => [product, ...current]); setMovements(current => [movement, ...current]); setIsNewItemModalOpen(false); setNewItem({ name: "", sku: "", aliases: "", category: "", brand: "", unit: "", purchaseUnit: "", unitsPerPurchase: "", location: "", warehouse: "", aisle: "", shelf: "", level: "", bin: "", group: "bodega", quantity: "", cost: "", minimum: "", assetType: "material", model: "", technicalReference: "", serialNumber: "", acquiredAt: "", warrantyUntil: "", assetCondition: "available" }); showToast(`Artículo "${product.name}" creado: ${quantity} ${product.unit} disponibles.`);
  }

  async function relocateProduct(product: StockProduct) {
    const destination = window.prompt("Nueva ubicación (Almacén · Pasillo · Estante · Nivel):", product.location);
    if (!destination || destination.trim() === product.location) return;
    const reason = window.prompt("Motivo del traslado:", "Reubicación interna")?.trim();
    if (!reason) return;
    const responsible = window.prompt("Responsable del traslado:", "")?.trim();
    if (!supabase || !scope) { showToast("No fue posible conectar con la base de datos.", "error"); return; }
    const reference = `TRASLADO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.rpc("relocate_inventory_stock", {
      p_stock_id: product.id,
      p_destination: destination.trim(),
      p_reference: reference,
      p_reason: reason,
      p_responsible_name: responsible || null,
      p_client_request_id: crypto.randomUUID(),
    });
    if (error) { showToast(error.message, "error"); return; }
    setProducts(current => current.map(p => p.id === product.id ? { ...p, location: destination.trim() } : p));
    showToast(`Ubicación de "${product.name}" actualizada a ${destination.trim()}.`);
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
      csvCell(m.id),
      csvCell(m.occurredAt),
      csvCell(movementLabels[m.type]),
      csvCell(m.reference),
      csvCell(m.productName),
      csvCell(m.quantity, true),
      csvCell(m.unit),
      csvCell(m.unitCost, true),
      csvCell(m.totalCost, true),
      csvCell(m.projectName || "Almacén Central"),
      csvCell(m.responsible),
      csvCell(m.notes),
    ]);

    const csvContent = "\uFEFF" + [headers.map((header) => csvCell(header)).join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
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
        <div className={`inventory-toast ${toastMessage.type}`} role="status" aria-live="polite">
          <span className="inventory-toast-icon">
            <InventoryIcon name={toastMessage.type === "success" ? "check" : "warning"} />
          </span>
          <p>{toastMessage.text}</p>
        </div>
      )}

      {/* Encabezado y acción principal */}
      <section className={`dashboard-heading inventory-heading ${isMovementsView ? "is-movements" : "is-inventory"}`}>
        <div className="inventory-heading-copy">
          <p>Módulo de Operaciones · RFC Enterprise</p>
          <h1>{isMovementsView ? "Kardex de movimientos" : "Control de inventario"}</h1>
          <small>
            {isMovementsView
              ? "Consulta el libro de movimientos y registra entradas, salidas, devoluciones o ajustes con su soporte."
              : `Catálogo activo con ${numberFormatter.format(products.length)} artículos, existencias y costos en un solo lugar.`}
          </small>
        </div>
        <div className="inventory-heading-actions">
          {isMovementsView ? (
            <button className="inventory-action primary" onClick={() => openMovementModal()} type="button">
              <InventoryIcon name="plus" />
              Registrar movimiento
            </button>
          ) : (
            <>
              <Link className="inventory-action secondary" href="/inventory/import">
                Importar inventario
              </Link>
              <button className="inventory-action secondary" onClick={() => setIsNewItemModalOpen(true)} type="button">
                Nuevo artículo
              </button>
              <button className="inventory-action primary" onClick={() => openMovementModal()} type="button">
                <InventoryIcon name="plus" />
                Registrar movimiento
              </button>
            </>
          )}
        </div>
      </section>

      {/* Aviso de Conexión */}
      {dataSource === "database" ? (
        <p className="inventory-session-notice">
          Datos sincronizados con Supabase.
        </p>
      ) : (
        <p className="inventory-session-notice">
          Sin conexión operativa: las acciones requieren la base de datos.
        </p>
      )}

      {loadError && (
        <p className="inventory-feedback error" role="alert">
          {loadError}
        </p>
      )}

      {/* Indicadores compactos: el catálogo y el Kardex conservan el foco. */}
      {!isMovementsView && (
        <section className="inventory-metric-grid" aria-label="Indicadores de inventario">
          <article className="inventory-metric is-primary">
            <span className="inventory-metric-label">Artículos activos</span>
            <strong>{numberFormatter.format(products.length)}</strong>
            <small>Registrados en el catálogo</small>
          </article>
          <article className="inventory-metric">
            <span className="inventory-metric-label">Unidades disponibles</span>
            <strong>{numberFormatter.format(totalUnits)}</strong>
            <small>En almacén y frentes de trabajo</small>
          </article>
          <article className="inventory-metric">
            <span className="inventory-metric-label">Valor del inventario</span>
            <strong>{currencyFormatter.format(totalValuation)}</strong>
            <small>Valorización con costos conocidos</small>
          </article>
          <article className={`inventory-metric ${lowStockCount > 0 ? "is-alert" : ""}`}>
            <span className="inventory-metric-label">Requieren reposición</span>
            <strong>{numberFormatter.format(lowStockCount)}</strong>
            <small>Artículos en o bajo su mínimo</small>
          </article>
        </section>
      )}

      {/* Navegación principal y secciones secundarias */}
      {!isMovementsView && (
        <nav className="inventory-tabs-nav" aria-label="Secciones del módulo">
          <div className="inventory-tabs-primary">
            <button
              className={`tab-btn ${activeTab === "catalog" ? "active" : ""}`}
              onClick={() => setActiveTab("catalog")}
              aria-current={activeTab === "catalog" ? "page" : undefined}
              type="button"
            >
              <InventoryIcon name="box" />
              <span className="tab-label">Existencias</span>
              <span className="tab-count">{numberFormatter.format(filteredProducts.length)}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === "movements" ? "active" : ""}`}
              onClick={() => setActiveTab("movements")}
              aria-current={activeTab === "movements" ? "page" : undefined}
              type="button"
            >
              <InventoryIcon name="movement" />
              <span className="tab-label">Movimientos</span>
              <span className="tab-count">{numberFormatter.format(movements.length)}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === "projects" ? "active" : ""}`}
              onClick={() => setActiveTab("projects")}
              aria-current={activeTab === "projects" ? "page" : undefined}
              type="button"
            >
              <InventoryIcon name="project" />
              <span className="tab-label">Obras</span>
              <span className="tab-count">{numberFormatter.format(projects.length)}</span>
            </button>
          </div>
          <div className="inventory-tabs-secondary">
            <span className="inventory-tabs-label">Más</span>
            <button
              className={`tab-btn ${activeTab === "low-stock" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("low-stock");
                setStockFilter("low");
              }}
              aria-current={activeTab === "low-stock" ? "page" : undefined}
              type="button"
            >
              <span className="tab-label">Alertas</span>
              {lowStockCount > 0 && <span className="tab-badge">{lowStockCount}</span>}
            </button>
            <button
              className={`tab-btn ${activeTab === "writeoffs" ? "active" : ""}`}
              onClick={() => setActiveTab("writeoffs")}
              aria-current={activeTab === "writeoffs" ? "page" : undefined}
              type="button"
              title="Bajas de inventario por deterioro, daño, vencimiento o pérdida"
            >
              <span className="tab-label">Bajas</span>
            </button>
            <button
              className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
              aria-current={activeTab === "settings" ? "page" : undefined}
              type="button"
            >
              <span className="tab-label">Configuración</span>
            </button>
          </div>
        </nav>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 1: CATÁLOGO DE EXISTENCIAS */}
      {/* ========================================================================= */}
      {!isMovementsView && activeTab === "catalog" && (
        <section className="dashboard-panel inventory-catalog-panel">
          <div className="panel-title inventory-panel-title">
            <div>
              <p>Existencias físicas</p>
              <h2>Catálogo de materiales y herramientas</h2>
            </div>
          </div>

          {/* Búsqueda principal y filtros agrupados */}
          <div className="inventory-catalog-controls">
            <label className="search-field inventory-search-field" htmlFor="inventory-catalog-search">
              Buscar artículo
              <input
                id="inventory-catalog-search"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Nombre, SKU, marca, categoría o ubicación…"
                type="search"
                value={query}
              />
              {query.trim() && <div className="catalog-live-results" role="listbox" aria-label="Coincidencias de artículos">
                {catalogSearchResults.length ? catalogSearchResults.map((product) => <button key={product.id} type="button" className="autocomplete-item" onClick={() => { setQuery(product.name); setGroupFilter("all"); setItemKindFilter("all"); setStockFilter("all"); setLocationFilter("all"); setCategoryFilter("all"); setCurrentPage(1); }}><span><strong>{product.name}</strong><small>{product.sku || "Sin código"} · {product.category}</small></span><b>{product.available} {product.unit}</b></button>) : <p className="autocomplete-empty">No se encontraron artículos.</p>}
              </div>}
            </label>

            <div className="inventory-filter-grid" aria-label="Filtros del catálogo">
              <label>
                Grupo
                <select
                  onChange={(e) => {
                    setGroupFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  value={groupFilter}
                >
                  <option value="all">Todos los grupos</option>
                  <option value="bodega">Bodega principal</option>
                  <option value="dotacion">Dotación</option>
                  <option value="trabajadores">Herramientas trabajadores</option>
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
                  <option value="out">Sin existencias (agotados)</option>
                </select>
              </label>

              <label>
                Tipo operativo
                <select value={itemKindFilter} onChange={(e) => { setItemKindFilter(e.target.value as typeof itemKindFilter); setCurrentPage(1); }}>
                  <option value="all">Todos</option>
                  <option value="material">Material / insumo</option>
                  <option value="tool">Herramienta</option>
                  <option value="equipment">Equipo</option>
                  <option value="ppe">Dotación / EPP</option>
                </select>
              </label>

              <label>
                Ubicación
                <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="all">Todas las ubicaciones</option>
                  {[...new Set(products.map((p) => p.location).filter(Boolean))].sort().map((location) => <option key={location} value={location}>{location}</option>)}
                </select>
              </label>

              <label>
                Categoría
                <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="all">Todas las categorías</option>
                  {[...new Set(products.map((p) => p.category).filter(Boolean))].sort().map((category) => <option key={category} value={category}>{category}</option>)}
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
          </div>

          <p className="inventory-table-scroll-hint">Desliza horizontalmente para consultar todas las columnas.</p>
          <div className="inventory-table-container">
            <table className="inventory-data-table inventory-catalog-table" aria-label="Catálogo de existencias">
              <thead>
                <tr>
                  <th className="col-item">Artículo / especificación</th>
                  <th className="col-location">Ubicación</th>
                  <th className="col-group">Grupo</th>
                  <th className="is-numeric">Costo unitario</th>
                  <th className="is-numeric">Disponible</th>
                  <th className="is-center">Estado</th>
                  <th className="is-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr className="inventory-empty-row">
                    <td colSpan={7} className="inventory-empty-cell">
                      No se encontraron artículos con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p) => {
                    const st = stockState(p);
                    return (
                      <tr key={p.id}>
                        <td className="cell-item" data-label="Artículo">
                          <strong title={p.name}>{p.name}</strong>
                          <small>
                            {p.sku ? `SKU: ${p.sku} · ` : ""}
                            {p.category} {p.brand ? `· ${p.brand}` : ""}
                          </small>
                        </td>
                        <td className="cell-location" data-label="Ubicación">
                          <span className="location-tag">{p.location || "Sin ubicación"}</span>
                        </td>
                        <td className="cell-group" data-label="Grupo">
                          <span className="group-tag">{p.inventoryGroupName}</span>
                          <small>{getInventoryItemKind(p) === "material" ? "Material / insumo" : getInventoryItemKind(p) === "tool" ? "Herramienta" : getInventoryItemKind(p) === "equipment" ? "Equipo" : "Dotación / EPP"}</small>
                        </td>
                        <td className="cell-numeric" data-label="Costo unitario">
                          {(p.unitCost ?? 0) > 0 ? currencyFormatter.format(p.unitCost ?? 0) : <span className="pending-cost">Pendiente</span>}
                        </td>
                        <td className="cell-numeric cell-stock" data-label="Disponible">
                          <b className="stock-quantity">
                            {p.available} <small>{p.unit}</small>
                          </b>
                          {p.minimum !== null && <span className="stock-min-hint">Mín: {p.minimum}</span>}
                        </td>
                        <td className="cell-status" data-label="Estado">
                          <span className={`status-pill ${st.className}`}>{st.label}</span>
                        </td>
                        <td className="cell-actions" data-label="Acciones">
                          <div className="row-actions" role="group" aria-label={`Acciones para ${p.name}`}>
                            <button
                              className="btn-row-action"
                              onClick={() => openMovementModal(p, "exit")}
                              title="Despachar para obra"
                              aria-label={`Despachar ${p.name} para obra`}
                              type="button"
                            >
                              Despachar
                            </button>
                            <button
                              className="btn-row-action"
                              onClick={() => openMovementModal(p, "entry")}
                              title="Ingresar material a bodega"
                              aria-label={`Registrar entrada de ${p.name}`}
                              type="button"
                            >
                              Entrada
                            </button>
                            <button
                              className="btn-row-action subtle"
                              onClick={() => {
                                setEditingMinimumProduct(p);
                                setNewMinimumValue(p.minimum !== null ? String(p.minimum) : "");
                              }}
                              title="Configurar nivel mínimo de stock"
                              aria-label={`Configurar mínimo de ${p.name}`}
                              type="button"
                            >
                              Mínimo
                            </button>
                            <button
                              className="btn-row-action subtle"
                              onClick={() => relocateProduct(p)}
                              title="Trasladar a otra ubicación"
                              aria-label={`Reubicar ${p.name}`}
                              type="button"
                            >
                              Reubicar
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

          <div className="inventory-table-footer">
            <span className="pagination-summary">
              Mostrando <b>{paginatedProducts.length}</b> de <b>{numberFormatter.format(filteredProducts.length)}</b> artículos
            </span>
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
          </div>
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
              Crear obra
            </button>
          </div>

          <p className="panel-intro">
            Consulta cuánto material se ha despachado a cada obra frente a su presupuesto. Gasto acumulado registrado:{" "}
            <b>{currencyFormatter.format(totalProjectExpenses)}</b>.
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
                      <span className={isOverBudget ? "budget-warning-label" : undefined}>{isOverBudget ? "Sobrecosto" : `${data.movementsCount} despachos`}</span>
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
                      Despachar material a esta obra
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
          <div className="panel-title inventory-panel-title">
            <div>
              <p>Trazabilidad y Kardex</p>
              <h2>Movimientos registrados</h2>
              <small className="inventory-panel-summary">
                {numberFormatter.format(movements.length)} movimientos en el libro de inventario.
              </small>
            </div>
            <div className="inventory-panel-actions">
              <button className="inventory-action secondary" onClick={exportMovementsCSV} type="button">
                <InventoryIcon name="download" />
                Descargar CSV
              </button>
            </div>
          </div>

          {/* Filtros del Kardex */}
          <div className="inventory-movement-controls">
            <label>
              Tipo de movimiento
              <select onChange={(e) => { setMovementTypeFilter(e.target.value); setMovementPage(1); }} value={movementTypeFilter}>
                <option value="all">Todos los movimientos</option>
                <option value="exit">Salidas a obra / proyectos</option>
                <option value="entry">Entradas de compra / proveedores</option>
                <option value="return">Devoluciones a bodega</option>
                <option value="adjustment">Ajustes de inventario</option>
                <option value="transfer">Traslados de ubicación</option>
              </select>
            </label>

            <label>
              Obra o proyecto
              <select onChange={(e) => { setMovementProjectFilter(e.target.value); setMovementPage(1); }} value={movementProjectFilter}>
                <option value="all">Todas las obras / almacén</option>
                {[...projects].sort((a, b) => spanishCollator.compare(`${a.code} ${a.name}`, `${b.code} ${b.name}`)).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="inventory-table-scroll-hint">Desliza horizontalmente para consultar todas las columnas.</p>
          <div className="inventory-table-container">
            <table className="inventory-data-table inventory-kardex-table" aria-label="Kardex de movimientos">
              <thead>
                <tr>
                  <th className="col-date">Fecha y hora</th>
                  <th className="col-item">Artículo</th>
                  <th className="col-type">Tipo</th>
                  <th className="is-numeric">Cantidad</th>
                  <th className="is-numeric">Existencia</th>
                  <th className="col-destination">Obra o destino</th>
                  <th className="col-responsible">Responsable</th>
                  <th className="col-reference">Referencia y soporte</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr className="inventory-empty-row">
                    <td colSpan={8} className="inventory-empty-cell">
                      No hay movimientos registrados con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((m) => {
                    const isExit = m.type === "exit" || (m.type === "adjustment" && m.quantityBefore != null && m.quantityAfter != null && m.quantityAfter < m.quantityBefore);
                    const isTransfer = m.type === "transfer";
                    const operationLabel = m.operationKind ? movementOperationLabels[m.operationKind] ?? m.operationKind : null;
                    return (
                      <tr key={m.id}>
                        <td className="cell-date" data-label="Fecha y hora">
                          <time className="mov-date">{m.occurredAt}</time>
                        </td>
                        <td className="cell-item" data-label="Artículo">
                          <b>{m.productName || "Artículo"}</b>
                        </td>
                        <td className="cell-type" data-label="Tipo">
                          <span className={`mov-badge ${m.type}`}>
                            {m.type === "entry" ? "Entrada" : m.type === "exit" ? "Salida" : m.type === "return" ? "Devolución" : m.type === "transfer" ? "Traslado" : "Ajuste"}
                          </span>
                        </td>
                        <td className="cell-numeric cell-quantity" data-label="Cantidad">
                          <span className="qty-indicator">
                            {isTransfer ? `${m.quantity} ${m.unit}` : `${isExit ? "-" : "+"}${m.quantity} ${m.unit}`}
                          </span>
                        </td>
                        <td className="cell-numeric cell-balance" data-label="Existencia (antes → después)">
                          {m.quantityBefore != null && m.quantityAfter != null ? (
                            <span
                              className="balance-value"
                              aria-label={`Existencia anterior ${m.quantityBefore}; existencia posterior ${m.quantityAfter}`}
                            >
                              {numberFormatter.format(m.quantityBefore)}
                              <span aria-hidden="true"> → </span>
                              {numberFormatter.format(m.quantityAfter)}
                            </span>
                          ) : (
                            <span className="balance-empty">Sin saldo histórico</span>
                          )}
                        </td>
                        <td className="cell-destination" data-label="Obra o destino">
                          {m.projectName ? (
                            <span className="dest-tag">{m.projectName}</span>
                          ) : (
                            <span className="dest-tag is-warehouse">Almacén central</span>
                          )}
                        </td>
                        <td className="cell-responsible" data-label="Responsable">
                          <span>{m.responsible || "Personal de almacén"}</span>
                        </td>
                        <td className="cell-reference" data-label="Referencia, soporte y costo">
                          <strong>{m.reference}</strong>
                          {operationLabel && <small className="mov-notes">Origen: {operationLabel}</small>}
                          {m.notes && <small className="mov-notes mov-notes-long" title={m.notes}>{m.notes}</small>}
                          <small className="mov-notes mov-cost">
                            <span>Total {currencyFormatter.format(m.totalCost || 0)}</span>
                            <span>Unit. {currencyFormatter.format(m.unitCost || 0)}</span>
                          </small>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="inventory-table-footer">
            <span className="pagination-summary">
              Mostrando <b>{paginatedMovements.length}</b> de <b>{numberFormatter.format(filteredMovements.length)}</b> movimientos
            </span>
            {movementTotalPages > 1 && (
              <div className="pagination-bar">
                <button
                  className="btn-page"
                  disabled={movementPage === 1}
                  onClick={() => setMovementPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  ← Anterior
                </button>
                <span>
                  Página <b>{movementPage}</b> de <b>{movementTotalPages}</b>
                </span>
                <button
                  className="btn-page"
                  disabled={movementPage === movementTotalPages}
                  onClick={() => setMovementPage((page) => Math.min(movementTotalPages, page + 1))}
                  type="button"
                >
                  Siguiente →
                </button>
              </div>
            )}
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

          <p className="inventory-table-scroll-hint">Desliza horizontalmente para consultar todas las columnas.</p>
          <div className="inventory-table-container">
            <table className="inventory-data-table inventory-lowstock-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>Ubicación</th>
                  <th>Grupo</th>
                  <th className="is-numeric">Existencia actual</th>
                  <th className="is-numeric">Mínimo configurado</th>
                  <th className="is-numeric">Déficit / sugerencia de compra</th>
                  <th className="is-actions">Acción</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((p) => p.minimum !== null && p.available <= p.minimum)
                  .map((p) => {
                    const deficit = Math.max(0, (p.minimum || 0) - p.available);
                    return (
                      <tr key={p.id}>
                        <td className="cell-item" data-label="Artículo">
                          <strong>{p.name}</strong>
                          <small>{p.category}</small>
                        </td>
                        <td className="cell-location" data-label="Ubicación">{p.location}</td>
                        <td className="cell-group" data-label="Grupo">{p.inventoryGroupName}</td>
                        <td className="cell-numeric cell-stock" data-label="Existencia actual">
                          <b className={p.available === 0 ? "stock-critical" : "stock-low"}>
                            {p.available} {p.unit}
                          </b>
                        </td>
                        <td className="cell-numeric cell-minimum" data-label="Mínimo configurado">
                          {p.minimum} {p.unit}
                        </td>
                        <td className="cell-numeric cell-deficit" data-label="Déficit / sugerencia de compra">
                          <span className="deficit-badge">Pedir mín. +{deficit + 5} {p.unit}</span>
                        </td>
                        <td className="cell-actions" data-label="Acción">
                          <button
                            className="btn-row-action"
                            onClick={() => openMovementModal(p, "entry")}
                            type="button"
                          >
                            Registrar compra
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
      {!isMovementsView && activeTab === "writeoffs" && (
        <section className="dashboard-panel writeoffs-tab-panel">
          <WriteoffsPanel
            products={products}
            scope={scope}
            notify={showToast}
            onStockChanged={(stockId, delta) =>
              setProducts((current) =>
                current.map((product) =>
                  product.id === stockId ? { ...product, available: Math.max(0, product.available + delta) } : product,
                ),
              )
            }
          />
        </section>
      )}
      {!isMovementsView && activeTab === "settings" && (
        <section className="dashboard-panel inventory-settings-panel">
          <div className="panel-title"><div><p>Administración</p><h2>Catálogos y ubicaciones</h2></div></div>
          <p className="panel-intro">Crea categorías y ubicaciones. Los registros usados se desactivan o reasignan; no se eliminan.</p>
          <div className="inventory-settings-grid">
            <article className="project-card"><h3>Nueva categoría</h3><form className="inventory-settings-form" onSubmit={createCategory}><label htmlFor="new-category">Nombre de categoría</label><input id="new-category" placeholder="Ej. Soldadura y oxicorte" value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)}/><button className="inventory-action" type="submit">Crear categoría</button></form>{customCategories.map(x=><p key={x}>{x}</p>)}</article>
            <article className="project-card"><h3>Nueva ubicación</h3><form className="inventory-settings-form" onSubmit={createLocation}><label htmlFor="new-location">Ruta de ubicación</label><input id="new-location" placeholder="Bodega · Pasillo · Estante · Nivel" value={newLocationName} onChange={e=>setNewLocationName(e.target.value)}/><button className="inventory-action" type="submit">Crear ubicación</button></form>{customLocations.map(x=><p key={x}>{x}</p>)}</article>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR MOVIMIENTO CON COSTEO */}
      {/* ========================================================================= */}
      {isMovementModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="movement-modal-title">
          <div className="modal-card inventory-movement-modal">
            <div className="modal-header">
              <div>
                <p>Operación de almacén</p>
                <h3 id="movement-modal-title">Registrar movimiento</h3>
              </div>
              <button className="btn-close-modal" aria-label="Cerrar" onClick={() => setIsMovementModalOpen(false)} type="button">
                <InventoryIcon name="close" />
              </button>
            </div>

            <form className="inventory-movement-form" onSubmit={handleSaveMovement}>
              <div className="inventory-movement-body">
                {/* Selector compacto de tipo */}
                <div className="movement-type-selector" role="group" aria-label="Tipo de movimiento">
                  <button
                    type="button"
                    className={`type-option exit ${movementType === "exit" ? "selected" : ""}`}
                    onClick={() => setMovementType("exit")}
                    aria-pressed={movementType === "exit"}
                  >
                    <span className="type-option-radio" aria-hidden="true" />
                    <span className="type-option-copy">
                      <strong>Salida</strong>
                      <small>Descuenta stock y carga costo a la obra</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`type-option entry ${movementType === "entry" ? "selected" : ""}`}
                    onClick={() => setMovementType("entry")}
                    aria-pressed={movementType === "entry"}
                  >
                    <span className="type-option-radio" aria-hidden="true" />
                    <span className="type-option-copy">
                      <strong>Entrada</strong>
                      <small>Aumenta las existencias de bodega</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`type-option return ${movementType === "return" ? "selected" : ""}`}
                    onClick={() => setMovementType("return")}
                    aria-pressed={movementType === "return"}
                  >
                    <span className="type-option-radio" aria-hidden="true" />
                    <span className="type-option-copy">
                      <strong>Devolución</strong>
                      <small>Reintegra sobrantes de obra</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`type-option adjustment ${movementType === "adjustment" ? "selected" : ""}`}
                    onClick={() => setMovementType("adjustment")}
                    aria-pressed={movementType === "adjustment"}
                  >
                    <span className="type-option-radio" aria-hidden="true" />
                    <span className="type-option-copy">
                      <strong>Ajuste</strong>
                      <small>Corrige inventario o registra merma</small>
                    </span>
                  </button>
                </div>

                {movementType === "adjustment" && (
                  <div className="form-group">
                    <label htmlFor="movement-adjustment-direction">Resultado del ajuste</label>
                    <select
                      id="movement-adjustment-direction"
                      value={adjustmentDirection}
                      onChange={(event) => setAdjustmentDirection(event.target.value as "increase" | "decrease")}
                    >
                      <option value="increase">Aumento de existencia</option>
                      <option value="decrease">Disminución / merma</option>
                    </select>
                  </div>
                )}

                <div className="form-group inventory-product-search-group">
                  <label htmlFor="movement-product-search">
                    {movementType === "entry" ? "Artículo a ingresar" : "Artículo a mover"} <span className="req">*</span>
                  </label>
                  <div className="inventory-product-search">
                    <input
                      id="movement-product-search"
                      placeholder="Busca por nombre, SKU o código de barras…"
                      value={modalSearch}
                      onFocus={() => setShowAutocomplete(true)}
                      onBlur={() => setShowAutocomplete(false)}
                      onChange={(e) => {
                        setModalSearch(e.target.value);
                        setShowAutocomplete(true);
                      }}
                    />
                    {showAutocomplete && (
                      <div className="autocomplete-results">
                        {[...products]
                          .filter((p) => matchesInventorySearch(p, modalSearch))
                          .sort((a, b) => spanishCollator.compare(a.name, b.name))
                          .slice(0, 8)
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="autocomplete-item"
                              onMouseDown={(event) => event.preventDefault()}
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
                        Artículo: <b>{selectedProduct.name}</b>
                      </span>
                      <span>
                        Stock actual: <b>{selectedProduct.available} {selectedProduct.unit}</b>
                      </span>
                    </div>
                  )}
                </div>

                {(movementType === "exit" || movementType === "return") && (
                  <div className="form-group">
                    <label htmlFor="movement-project">
                      {movementType === "return" ? "Obra de origen (opcional)" : "Obra / proyecto de destino"} {movementType === "exit" && <span className="req">*</span>}
                    </label>
                    <select
                      id="movement-project"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      required={movementType === "exit"}
                    >
                      <option value="">{movementType === "return" ? "Sin obra asociada" : "Selecciona una obra activa"}</option>
                      {[...projects].sort((a, b) => spanishCollator.compare(`${a.code} ${a.name}`, `${b.code} ${b.name}`)).map((prj) => (
                        <option key={prj.id} value={prj.id} disabled={prj.status !== "active"}>
                          {prj.code} - {prj.name} ({prj.status === "active" ? "Activa" : prj.status === "completed" ? "Finalizada" : "No disponible"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="movement-quantity">
                      Cantidad ({selectedProduct?.unit || "unidad"}) <span className="req">*</span>
                    </label>
                    <input
                      id="movement-quantity"
                      type="number"
                      min="1"
                      step="any"
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="movement-unit-cost">Costo unitario (COP)</label>
                    <CurrencyInput
                      id="movement-unit-cost"
                      value={unitCostInput}
                      onValueChange={setUnitCostInput}
                      placeholder="Vacío si aún no se conoce"
                    />
                    <small>Si se deja vacío, la base conserva el costo actual o lo deja pendiente; no inventa un valor.</small>
                  </div>
                </div>

                <div className="total-cost-banner">
                  <span>{movementType === "exit" ? "Costo total del despacho" : "Valor total del movimiento"}</span>
                  <strong>
                    {currencyFormatter.format((Number(quantityInput) || 0) * (unitCostInput.trim() === "" ? (selectedProduct?.unitCost ?? 0) : (Number(unitCostInput) || 0)))}
                  </strong>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="movement-reference">
                      N.º vale / remisión / factura <span className="req">*</span>
                    </label>
                    <input
                      id="movement-reference"
                      placeholder="Ej. VALE-2026-04 o FACT-904"
                      value={referenceInput}
                      onChange={(e) => setReferenceInput(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="movement-responsible">Responsable / quien recibe</label>
                    <input
                      id="movement-responsible"
                      placeholder="Ej. Carlos Restrepo (maestro)"
                      value={responsibleInput}
                      onChange={(e) => setResponsibleInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="movement-notes">Notas u observaciones</label>
                  <input
                    id="movement-notes"
                    placeholder="Ej. Material para armado de zapatas bloque B"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                  />
                </div>

                {formError && <p className="modal-form-error" role="alert">{formError}</p>}
              </div>

              <div className="modal-actions inventory-movement-actions">
                <button className="btn-cancel" onClick={() => setIsMovementModalOpen(false)} type="button" disabled={isSavingMovement}>
                  Cancelar
                </button>
                <button className="inventory-action" type="submit" disabled={isSavingMovement} aria-busy={isSavingMovement}>
                  {isSavingMovement
                    ? "Registrando…"
                    : movementType === "entry"
                      ? "Registrar entrada"
                      : movementType === "exit"
                        ? "Registrar salida"
                        : movementType === "return"
                          ? "Registrar devolución"
                          : "Registrar ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewItemModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-item-title"><div className="modal-card"><div className="modal-header"><div><p>Catálogo de inventario</p><h3 id="new-item-title">Nuevo artículo</h3></div><button className="btn-close-modal" aria-label="Cerrar" onClick={() => setIsNewItemModalOpen(false)} type="button">×</button></div><form onSubmit={handleCreateItem}><div className="form-grid-2"><div className="form-group"><label>Nombre *</label><input required value={newItem.name} onChange={e => setNewItem(v => ({ ...v, name: e.target.value }))} /></div><div className="form-group"><label>SKU / código de barras</label><input value={newItem.sku} onChange={e => setNewItem(v => ({ ...v, sku: e.target.value }))} /></div></div><div className="form-grid-2"><div className="form-group"><label>Tipo / categoría *</label><InlineCatalogCombobox label="Tipo o categoría" options={categoryOptions} onChange={category => setNewItem(v => ({ ...v, category }))} onCreate={category => setCustomCategories(values => [...new Set([...values, category])])} placeholder="Busca o crea una categoría" required value={newItem.category} /></div><div className="form-group"><label>Marca</label><InlineCatalogCombobox label="Marca" options={brandOptions} onChange={brand => setNewItem(v => ({ ...v, brand }))} onCreate={brand => setCustomBrands(values => [...new Set([...values, brand])])} placeholder="Busca o crea una marca" value={newItem.brand} /></div></div><div className="form-grid-2"><div className="form-group"><label>Unidad de consumo *</label><InlineCatalogCombobox label="Unidad de consumo" options={unitOptions} onChange={unit => setNewItem(v => ({ ...v, unit }))} onCreate={unit => setCustomUnits(values => [...new Set([...values, unit])])} placeholder="Ej. unidad" required value={newItem.unit} /></div><div className="form-group"><label>Presentación de compra *</label><InlineCatalogCombobox label="Presentación de compra" options={unitOptions} onChange={purchaseUnit => setNewItem(v => ({ ...v, purchaseUnit }))} onCreate={purchaseUnit => setCustomUnits(values => [...new Set([...values, purchaseUnit])])} placeholder="Ej. caja" required value={newItem.purchaseUnit} /></div></div><div className="form-grid-2"><div className="form-group"><label>Contenido por presentación *</label><input min="1" placeholder="Ej. 100" required step="any" type="number" value={newItem.unitsPerPurchase} onChange={e => setNewItem(v => ({ ...v, unitsPerPurchase: e.target.value }))} /></div><div className="form-group"><label>Cantidad recibida *</label><input min="0.001" placeholder="Ej. 3 cajas" required step="any" type="number" value={newItem.quantity} onChange={e => setNewItem(v => ({ ...v, quantity: e.target.value }))} /></div></div><div className="form-grid-2"><div className="form-group"><label>Costo por presentación COP *</label><input type="number" min="0" step="any" required value={newItem.cost} onChange={e => setNewItem(v => ({ ...v, cost: e.target.value }))} /></div><div className="form-group"><label>Stock mínimo ({newItem.unit || "consumo"})</label><input type="number" min="0" value={newItem.minimum} onChange={e => setNewItem(v => ({ ...v, minimum: e.target.value }))} /></div></div>{Number(newItem.quantity) > 0 && Number(newItem.unitsPerPurchase) > 0 ? <p className="conversion-preview">Se registrarán <strong>{Number(newItem.quantity) * Number(newItem.unitsPerPurchase)} {newItem.unit || "unidades"}</strong> en stock ({newItem.quantity} {newItem.purchaseUnit || "presentaciones"} × {newItem.unitsPerPurchase}).</p> : null}<div className="form-group"><label>Ubicación *</label><InlineCatalogCombobox label="Ubicación" options={locationOptions} onChange={location => setNewItem(v => ({ ...v, location }))} onCreate={location => setCustomLocations(values => [...new Set([...values, location])])} placeholder="Busca o crea una ubicación" required value={newItem.location} /></div><div className="modal-actions"><button className="btn-cancel" type="button" onClick={() => setIsNewItemModalOpen(false)}>Cancelar</button><button className="inventory-action" type="submit">Crear y registrar entrada</button></div></form></div></div>
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
                  <CurrencyInput
                    placeholder="25000000"
                    value={newProjectBudget}
                    onValueChange={setNewProjectBudget}
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
