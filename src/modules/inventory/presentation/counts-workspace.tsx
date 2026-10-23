"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

type Branch = { branch_id: string; branch_name: string; company_id: string };
type CountSession = {
  id: string;
  reason: string;
  status: "draft" | "approved" | "submitted" | "cancelled";
  count_kind: "initial" | "periodic";
  scope_type: "all" | "location" | "category";
  scope_value: string | null;
  expected_line_count: number;
  counted_at: string;
  approved_at: string | null;
};
type CountLine = {
  id: string;
  stock_id: string;
  system_quantity: number;
  counted_quantity: number | null;
  counted_location: string | null;
  unit_cost: number | null;
  notes: string | null;
  counted_by: string | null;
  counted_by_name: string | null;
  counted_at: string | null;
  item_data: ItemData | null;
  inventory_stock: {
    location: string | null;
    inventory_items: {
      sku: string | null;
      name: string;
      category: string | null;
      unit: string | null;
    } | null;
  } | null;
};
type ItemData = {
  sku: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  technical_reference: string;
  model: string;
  serial_number: string;
  asset_condition: string;
  purchase_unit: string;
  units_per_purchase: string;
  purchase_unit_cost: string;
  minimum_quantity: string;
  reorder_quantity: string;
};
type CountLinePageRow = {
  id: string; stock_id: string; system_quantity: number; counted_quantity: number | null;
  counted_location: string | null; unit_cost: number | null; notes: string | null;
  counted_by: string | null; counted_by_name: string | null; counted_at: string | null;
  item_data: ItemData | null; location: string | null; sku: string | null; name: string;
  category: string | null; unit: string | null; total_count: number;
};
type NewItem = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  unit: string;
  location: string | null;
  counted_quantity: number;
  unit_cost: number | null;
  notes: string | null;
  status: "draft" | "approved";
  counted_by_name: string | null;
  counted_at: string;
};
type LineDraft = {
  quantity: string;
  location: string;
  cost: string;
  notes: string;
  item: ItemData;
};
type NewItemDraft = {
  sku: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  location: string;
  quantity: string;
  cost: string;
  notes: string;
};

const PAGE_SIZE = 50;
const emptyNewItem: NewItemDraft = {
  sku: "",
  name: "",
  category: "",
  brand: "",
  unit: "unidad",
  location: "",
  quantity: "",
  cost: "",
  notes: "",
};

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvCell(value: string | number | null | undefined) {
  const raw = value === null || value === undefined ? "" : String(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function itemDataFromLine(line: CountLine): ItemData {
  const item = line.inventory_stock?.inventory_items;
  const data = line.item_data ?? ({} as ItemData);
  return {
    sku: textValue(data.sku || item?.sku), name: textValue(data.name || item?.name),
    category: textValue(data.category || item?.category), brand: textValue(data.brand),
    unit: textValue(data.unit || item?.unit || "unidad"), technical_reference: textValue(data.technical_reference),
    model: textValue(data.model), serial_number: textValue(data.serial_number), asset_condition: textValue(data.asset_condition),
    purchase_unit: textValue(data.purchase_unit), units_per_purchase: textValue(data.units_per_purchase),
    purchase_unit_cost: textValue(data.purchase_unit_cost), minimum_quantity: textValue(data.minimum_quantity), reorder_quantity: textValue(data.reorder_quantity),
  };
}

function countMessage(message: string) {
  return message
    .replaceAll("f?sica", "física")
    .replaceAll("f?sico", "físico")
    .replaceAll("est?", "está")
    .replaceAll("art?culo", "artículo")
    .replaceAll("fotograf?a", "fotografía")
    .replaceAll("conciliaci?n", "conciliación")
    .replaceAll("revisi?n", "revisión")
    .replaceAll("cat?logo", "catálogo")
    .replaceAll("tambi?n", "también")
    .replaceAll("d?as", "días")
    .replaceAll("despu?s", "después")
    .replaceAll("jam?s", "jamás")
    .replaceAll("cambi?", "cambió")
    .replaceAll("l?nea", "línea")
    .replaceAll(" ? ", " - ");
}

export function CountsWorkspace() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [session, setSession] = useState<CountSession | null>(null);
  const [history, setHistory] = useState<CountSession[]>([]);
  const [lines, setLines] = useState<CountLine[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [query, setQuery] = useState("");
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [totalCounted, setTotalCounted] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [canApprove, setCanApprove] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [countKind, setCountKind] = useState<"initial" | "periodic">("initial");
  const [scopeType, setScopeType] = useState<"all" | "location" | "category">("all");
  const [scopeValue, setScopeValue] = useState("");
  const [selectedLine, setSelectedLine] = useState<CountLine | null>(null);
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemDraft, setNewItemDraft] = useState<NewItemDraft>(emptyNewItem);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [reviewedDifferences, setReviewedDifferences] = useState(false);

  const client = () =>
    isSupabaseConfigured && supabaseUrl && supabasePublishableKey
      ? createBrowserClient(supabaseUrl, supabasePublishableKey)
      : null;

  async function loadSession(target?: CountSession | null) {
    const supabase = client();
    const active = target ?? session;
    if (!supabase || !active) return;
    setLoadError("");
    setHasLoaded(false);
    // Carga paginada desde PostgreSQL para evitar timeouts y filtrado local.
    const [pageResult, summaryResult, newItemResult] = await Promise.all([
      supabase.rpc("count_lines_page", {
        p_count_id: active.id,
        p_search: query.trim() || null,
        p_page: page,
        p_page_size: PAGE_SIZE,
      }),
      supabase.rpc("count_summary", { p_count_id: active.id }),
      supabase
        .from("physical_count_new_items")
        .select(
          "id,sku,name,category,brand,unit,location,counted_quantity,unit_cost,notes,status,counted_by_name,counted_at",
        )
        .eq("count_id", active.id)
        .order("created_at")
        .order("id")
        .range(0, PAGE_SIZE - 1),
    ]);
    if (pageResult.error || summaryResult.error || newItemResult.error) {
      const message =
        pageResult.error?.message ??
        summaryResult.error?.message ??
        newItemResult.error?.message ??
        "No fue posible cargar la jornada.";
      const friendlyMessage = /statement timeout/i.test(message)
        ? "La jornada es grande y tardó más de lo permitido. Intenta nuevamente; si persiste, solicita aplicar la optimización de conteo."
        : countMessage(message);
      setLoadError(friendlyMessage);
      setStatus(friendlyMessage);
      setHasLoaded(false);
      return;
    }
    const rows = (pageResult.data ?? []) as CountLinePageRow[];
    const normalizedLines = rows.map((row) => ({
      id: row.id,
      stock_id: row.stock_id,
      system_quantity: row.system_quantity,
      counted_quantity: row.counted_quantity,
      counted_location: row.counted_location,
      unit_cost: row.unit_cost,
      notes: row.notes,
      counted_by: row.counted_by,
      counted_by_name: row.counted_by_name,
      counted_at: row.counted_at,
      item_data: row.item_data ?? null,
      inventory_stock: {
        location: row.location,
        inventory_items: {
          sku: row.sku,
          name: row.name,
          category: row.category,
          unit: row.unit,
        },
      },
    })) as CountLine[];
    setLines(normalizedLines);
    setNewItems((newItemResult.data ?? []) as NewItem[]);
    const summary = (summaryResult.data ?? [])[0] ?? {};
    setTotalCounted(Number(summary.counted_lines ?? 0));
    setTotalLines(Number(summary.expected_lines ?? rows[0]?.total_count ?? 0));
    setHasLoaded(true);
    setLastUpdated(new Date().toLocaleString("es-CO"));
  }

  async function loadWorkspace() {
    const supabase = client();
    if (!supabase) {
      setStatus("Supabase no est? configurado para registrar conteos.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setHasLoaded(false);
    setLoadError("");
    const [
      { data: branchData, error: branchError },
      { data: sessionData, error: sessionError },
    ] = await Promise.all([
      supabase.rpc("inventory_count_branches"),
      supabase
        .from("physical_counts")
        .select(
          "id,reason,status,count_kind,scope_type,scope_value,expected_line_count,counted_at,approved_at",
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    if (branchError || sessionError) {
      setStatus(
        branchError?.message ??
          sessionError?.message ??
          "No fue posible cargar Conteos físicos.",
      );
      setIsLoading(false);
      return;
    }
    const sessions = (sessionData ?? []) as CountSession[];
    const active = sessions.find((item) => item.status === "draft") ?? null;
    setBranches((branchData ?? []) as Branch[]);
    setHistory(sessions);
    setSession(active);
    if (active) await loadSession(active);
    // Permisos efectivos: solo quien tenga inventory.count.approve puede conciliar.
    try {
      const { data: permRows } = await supabase.rpc("my_effective_permissions");
      const perms = ((permRows ?? []) as Array<{ code: string }>).map((r) => r.code);
      setCanApprove(perms.includes("inventory.count.approve"));
    } catch {
      setCanApprove(false);
    }
    setIsLoading(false);
  }

  // La carga se difiere para no disparar actualizaciones de estado durante el montaje.
  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => void loadSession(session), 0);
    return () => window.clearTimeout(timer);
  }, [page, query, session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh || !session) return;
    const timer = window.setInterval(() => {
      void loadSession(session);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = client();
    if (!supabase || !session) return;
    const channel = supabase
      .channel(`counts-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "physical_count_lines", filter: `count_id=eq.${session.id}` },
        () => {
          void loadSession(session);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "physical_count_new_items", filter: `count_id=eq.${session.id}` },
        () => {
          void loadSession(session);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isSaving) return;
      setSelectedLine(null);
      setLineDraft(null);
      setNewItemOpen(false);
      setApprovalOpen(false);
      setOpenModal(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isSaving]);

  const countedLines = lines.filter((line) => line.counted_quantity !== null);
  const effectiveCounted = hasLoaded && !loadError ? totalCounted : countedLines.length;
  const effectiveTotal = hasLoaded && !loadError ? totalLines || (session?.expected_line_count ?? 0) : lines.length;
  const pendingLines = Math.max(0, (session?.expected_line_count ?? effectiveTotal) - effectiveCounted);
  const progress = session?.expected_line_count && hasLoaded && !loadError
    ? Math.round((effectiveCounted / session.expected_line_count) * 100)
    : lines.length
      ? Math.round((countedLines.length / lines.length) * 100)
      : 0;
  const filteredLines = useMemo(() => {
    let result = lines;
    if (onlyDifferences) {
      result = result.filter((line) => line.counted_quantity !== null && line.counted_quantity !== line.system_quantity);
    }
    const normalized = query.trim().toLocaleLowerCase("es-CO");
    if (!normalized) return result;
    return result.filter((line) => {
      const item = line.inventory_stock?.inventory_items;
      return `${item?.name ?? ""} ${item?.sku ?? ""} ${item?.category ?? ""}`
        .toLocaleLowerCase("es-CO")
        .includes(normalized);
    });
  }, [lines, query, onlyDifferences]);
  const pagedLines = filteredLines.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );
  const totalPages = Math.max(1, Math.ceil(filteredLines.length / PAGE_SIZE));
  const contributors = useMemo(() => {
    const totals = new Map<string, number>();
    for (const line of countedLines) {
      const name = line.counted_by_name ?? "Sin identificar";
      totals.set(name, (totals.get(name) ?? 0) + 1);
    }
    for (const item of newItems) {
      const name = item.counted_by_name ?? "Sin identificar";
      totals.set(name, (totals.get(name) ?? 0) + 1);
    }
    return [...totals.entries()].sort((left, right) => right[1] - left[1]);
  }, [countedLines, newItems]);
  const differences = countedLines.filter(
    (line) => line.counted_quantity !== line.system_quantity,
  );
  const pendingCosts = [...countedLines, ...newItems].filter(
    (item) => item.unit_cost === null,
  ).length;

  async function openCount() {
    const supabase = client();
    const branch = branches.find((item) => item.branch_id === selectedBranchId) ?? null;
    if (!supabase || !branch) {
      setStatus(
        "Selecciona una sede de inventario habilitada para abrir la jornada.",
      );
      return;
    }
    setIsSaving(true);
    const { data, error } = await supabase.rpc("open_physical_count", {
      p_branch_id: branch.branch_id,
      p_scope_type: scopeType,
      p_scope_value: scopeType === "all" ? null : scopeValue.trim() || null,
      p_reason: reason.trim() || null,
      p_count_kind: countKind,
    });
    setIsSaving(false);
    if (error || !data) {
      setStatus(
        countMessage(error?.message ?? "No fue posible abrir la jornada."),
      );
      return;
    }
    setOpenModal(false);
    setReason("");
    setStatus(
      "Jornada abierta. Cada guardado queda persistido como borrador hasta la conciliación final.",
    );
    await loadWorkspace();
  }

  function editLine(line: CountLine) {
    setSelectedLine(line);
    setLineDraft({
      quantity: line.counted_quantity?.toString() ?? "",
      location: line.counted_location ?? line.inventory_stock?.location ?? "",
      cost: line.unit_cost?.toString() ?? "",
      notes: line.notes ?? "",
    item: itemDataFromLine(line),
    });
  }

  async function saveLine() {
    const supabase = client();
    if (!supabase || !session || !selectedLine || !lineDraft) return;
    const quantity = numberOrNull(lineDraft.quantity);
    const cost = numberOrNull(lineDraft.cost);
    if (quantity === null || quantity < 0) {
      setStatus(
        "Indica una cantidad física válida, incluido 0 cuando no se encontró existencia.",
      );
      return;
    }
    if (cost !== null && cost < 0) {
      setStatus("El costo no puede ser negativo.");
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.rpc("save_physical_count_line", {
      p_count_id: session.id,
      p_stock_id: selectedLine.stock_id,
      p_counted_quantity: quantity,
      p_counted_location: lineDraft.location || null,
      p_unit_cost: cost,
      p_notes: lineDraft.notes || null,
    p_item_data: lineDraft.item,
    });
    setIsSaving(false);
    if (error) {
      setStatus(countMessage(error.message));
      return;
    }
    setStatus(
      "Conteo guardado en la jornada. Aún no cambia el inventario oficial.",
    );
    setSelectedLine(null);
    setLineDraft(null);
    await loadSession(session);
  }

  async function saveNewItem() {
    const supabase = client();
    if (!supabase || !session) return;
    const quantity = numberOrNull(newItemDraft.quantity);
    const cost = numberOrNull(newItemDraft.cost);
    if (
      !newItemDraft.sku.trim() ||
      !newItemDraft.name.trim() ||
      !newItemDraft.unit.trim() ||
      quantity === null ||
      quantity < 0
    ) {
      setStatus(
        "El artículo nuevo requiere SKU, nombre, unidad y cantidad física válida.",
      );
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.rpc("add_physical_count_new_item", {
      p_count_id: session.id,
      p_sku: newItemDraft.sku,
      p_name: newItemDraft.name,
      p_category: newItemDraft.category || null,
      p_brand: newItemDraft.brand || null,
      p_unit: newItemDraft.unit,
      p_location: newItemDraft.location || null,
      p_counted_quantity: quantity,
      p_unit_cost: cost,
      p_notes: newItemDraft.notes || null,
    });
    setIsSaving(false);
    if (error) {
      setStatus(countMessage(error.message));
      return;
    }
    setNewItemOpen(false);
    setNewItemDraft(emptyNewItem);
    setStatus(
      "Artículo nuevo guardado como hallazgo de la jornada. Se creará oficialmente al conciliar.",
    );
    await loadSession(session);
  }

  async function approve() {
    const supabase = client();
    if (!supabase || !session || pendingLines > 0 || !approvalConfirmed) return;
    setIsSaving(true);
    const { error } = await supabase.rpc("approve_physical_count", {
      target_count: session.id,
    });
    setIsSaving(false);
    if (error) {
      setStatus(countMessage(error.message));
      setApprovalOpen(false);
      return;
    }
    setApprovalOpen(false);
    setApprovalConfirmed(false);
    setStatus(
      "Jornada conciliada. El inventario oficial, los movimientos y la auditoría fueron actualizados.",
    );
    await loadWorkspace();
  }

  async function downloadReport() {
    if (!session) return;
    const supabase = client();
    if (!supabase) return;
    const allLines: CountLine[] = [];
    let currentPage = 0;
    while (true) {
      const { data } = await supabase.rpc("count_lines_page", {
        p_count_id: session.id,
        p_search: null,
        p_page: currentPage,
        p_page_size: 1000,
      });
      const rows = (data ?? []) as CountLinePageRow[];
      allLines.push(
        ...rows.map((row) => ({
          id: row.id,
          stock_id: row.stock_id,
          system_quantity: row.system_quantity,
          counted_quantity: row.counted_quantity,
          counted_location: row.counted_location,
          unit_cost: row.unit_cost,
          notes: row.notes,
          counted_by: row.counted_by,
          counted_by_name: row.counted_by_name,
          counted_at: row.counted_at,
          item_data: row.item_data ?? null,
      inventory_stock: {
            location: row.location,
            inventory_items: {
              sku: row.sku,
              name: row.name,
              category: row.category,
              unit: row.unit,
            },
          },
        })) as CountLine[],
      );
      if (rows.length < 1000) break;
      currentPage += 1;
    }
    const allNewItems: NewItem[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("physical_count_new_items")
        .select("id,sku,name,category,brand,unit,location,counted_quantity,unit_cost,notes,status,counted_by_name,counted_at")
        .eq("count_id", session.id)
        .order("created_at")
        .order("id")
        .range(from, from + 999);
      const batch = (data ?? []) as NewItem[];
      allNewItems.push(...batch);
      if (batch.length < 1000) break;
      from += 1000;
    }
    const rows = [
      [
        "Tipo",
        "SKU",
        "Artículo",
        "Sistema",
        "Físico",
        "Diferencia",
        "Ubicación",
        "Costo",
        "Cont?",
        "Fecha",
        "Notas",
      ],
      ...allLines.map((line) => [
        "Existente",
        line.inventory_stock?.inventory_items?.sku ?? "",
        line.inventory_stock?.inventory_items?.name ?? "",
        line.system_quantity,
        line.counted_quantity ?? "Pendiente",
        line.counted_quantity !== null ? line.counted_quantity - line.system_quantity : "Pendiente",
        line.counted_location ?? line.inventory_stock?.location ?? "",
        line.unit_cost ?? "Pendiente",
        line.counted_by_name ?? "",
        line.counted_at ?? "",
        line.notes ?? "",
      ]),
      ...newItems.map((item) => [
        "Nuevo",
        item.sku,
        item.name,
        0,
        item.counted_quantity,
        item.counted_quantity,
        item.location ?? "",
        item.unit_cost ?? "Pendiente",
        item.counted_by_name ?? "",
        item.counted_at,
        item.notes ?? "",
      ]),
    ];
    const content =
      "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `conteo-${session.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="dashboard-content counts-workspace">
      <section className="dashboard-heading">
        <div>
          <h1>Conteo físico</h1>
          <small>
            Jornada única para la bodega. El inventario se vuelve oficial al
            conciliar el 100 % de los artículos.
          </small>
        </div>
        <div className="counts-heading-actions">
          {session ? (
            <span className="count-session-badge">Jornada abierta</span>
          ) : null}
          {!session ? (
            <button
              className="inventory-action"
              type="button"
              onClick={() => {
                setSelectedBranchId(branches[0]?.branch_id ?? "");
                setCountKind("initial");
                setScopeType("all");
                setScopeValue("");
                setOpenModal(true);
              }}
            >
              Abrir jornada
            </button>
          ) : null}
          {session ? (
            <button
              className="btn-cancel"
              type="button"
              onClick={() => setNewItemOpen(true)}
            >
              Agregar artículo encontrado
            </button>
          ) : null}
          {session ? (
            <button
              className="btn-cancel"
              type="button"
              onClick={() => void loadSession(session)}
              disabled={isSaving}
            >
              Actualizar
            </button>
          ) : null}
          {session ? (
            <button
              className="inventory-action"
              type="button"
              disabled={isSaving || !hasLoaded || !!loadError || lines.length === 0 || pendingLines > 0 || !canApprove}
              onClick={() => {
                setApprovalConfirmed(false);
                setReviewedDifferences(false);
                setApprovalOpen(true);
              }}
            >
              Cerrar y conciliar
            </button>
          ) : null}
        </div>
      </section>

      <section
        className="dashboard-panel counts-progress-panel"
        aria-live="polite"
      >
        {isLoading ? (
          <p className="panel-intro">Cargando la jornada de conteo?</p>
        ) : session ? (
          <>
            <div className="counts-progress-heading">
              <div>
                <strong>{session.reason}</strong>
                <small>
                  {session.scope_type === "all"
                    ? "Toda la bodega"
                    : session.scope_value}
                </small>
              </div>
              <strong>
                {countedLines.length} de {session.expected_line_count} artículos
                contados | {progress}%
              </strong>
            </div>
            <div
              className="counts-progress-track"
              aria-label={`${progress}% del inventario contado`}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            {loadError ? (
              <p className="counts-status" role="alert">
                {countMessage(loadError)}
                <button
                  className="btn-cancel"
                  type="button"
                  onClick={() => session && void loadSession(session)}
                  style={{ marginLeft: 8 }}
                >
                  Reintentar carga
                </button>
              </p>
            ) : null}
            <p className="panel-intro">
              {!hasLoaded
                ? "Cargando la jornada…"
                : pendingLines
                  ? `Faltan ${pendingLines} artículo(s). Registra 0 cuando no exista físicamente.`
                  : totalLines > 0
                    ? "Cobertura completa. Revisa el resumen y concilia cuando estés listo."
                    : "Sin artículos cargados."}
            </p>
            {lastUpdated ? (
              <small className="panel-intro">Última actualización: {lastUpdated}</small>
            ) : null}
            {contributors.length ? (
              <small className="panel-intro">
                Participantes: {contributors.length} ({contributors.map(([name]) => name).join(", ")})
              </small>
            ) : null}
            {differences.length ? (
              <small className="panel-intro">
                Diferencias encontradas: {differences.length}
              </small>
            ) : null}
            {pendingCosts > 0 ? (
              <small className="panel-intro">
                Registros sin costo confirmado: {pendingCosts}
              </small>
            ) : null}
            {session ? (
              <label className="panel-intro">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />{" "}
                Actualización automática cada 30 s
              </label>
            ) : null}
          </>
        ) : (
          <p className="panel-intro">
            Abre la jornada inicial cuando el equipo vaya a comenzar. Los
            conteos se conservarán durante los días que necesiten.
          </p>
        )}
        {status ? (
          <p className="counts-status" role="status">
            {status}
          </p>
        ) : null}
      </section>

      {session ? (
        <>
          <section className="dashboard-panel">
            <div className="inventory-catalog-controls">
              <label className="search-field" htmlFor="count-search">
                Buscar artículo
                <input
                  id="count-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Nombre, SKU o categoría"
                />
              </label>
              <label className="counts-table-summary">
                <input
                  type="checkbox"
                  checked={onlyDifferences}
                  onChange={(event) => {
                    setOnlyDifferences(event.target.checked);
                    setPage(0);
                  }}
                />{" "}
                Solo diferencias
              </label>
              <div className="counts-table-summary">
                <strong>{filteredLines.length}</strong>
                <span>artículos visibles</span>
              </div>
            </div>
            <div className="inventory-table-container">
              <table className="inventory-data-table">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th>Ubicación</th>
                    <th>Saldo al abrir</th>
                    <th>Cantidad física</th>
                    <th>Registró</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLines.map((line) => {
                    const item = line.inventory_stock?.inventory_items;
                    const itemName = item?.name ?? "Artículo sin ficha";
                    const saved = line.counted_quantity !== null;
                    return (
                      <tr key={line.id}>
                        <td>
                          <button
                            className="table-link-button"
                            type="button"
                            onClick={() => editLine(line)}
                            title={itemName}
                            aria-label={`Registrar conteo de ${itemName}`}
                          >
                            <strong>{itemName}</strong>
                            <small>
                              {item?.sku ?? "Sin SKU"} |{" "}
                              {item?.unit ?? "unidad"}
                            </small>
                          </button>
                        </td>
                        <td>
                          {line.counted_location ??
                            line.inventory_stock?.location ??
                            "Sin ubicación"}
                        </td>
                        <td>{line.system_quantity}</td>
                        <td>
                          {saved ? line.counted_quantity : "Sin registrar"}
                        </td>
                        <td>{line.counted_by_name ?? "Sin identificar"}</td>
                        <td>
                          <span
                            className={`count-line-status ${saved ? (line.counted_quantity !== line.system_quantity ? "is-difference" : "is-counted") : ""}`}
                          >
                            {!saved
                              ? "Pendiente"
                              : line.counted_quantity !== line.system_quantity
                                ? "Requiere revisión"
                                : "Contado"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="counts-pagination">
                <button
                  className="btn-cancel"
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  className="btn-cancel"
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </section>

          <section
            className="counts-history"
            aria-label="Hallazgos y responsables"
          >
            <div className="counts-report-header">
              <strong>Equipo y hallazgos</strong>
              <button
                className="btn-cancel"
                type="button"
                onClick={downloadReport}
              >
                Descargar informe CSV
              </button>
            </div>
            <p>
              {newItems.length} artículo(s) nuevos encontrados | {pendingCosts}{" "}
              registro(s) sin costo declarado.
            </p>
            {contributors.length ? (
              <ul>
                {contributors.map(([name, count]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <small>{count} registro(s) guardados</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aún no hay artículos registrados.</p>
            )}
          </section>
        </>
      ) : null}

      <section className="counts-history" aria-label="Historial de jornadas">
        <strong>Últimas jornadas</strong>
        {history.length ? (
          <ul>
            {history.slice(0, 4).map((item) => (
              <li key={item.id}>
                <span>{item.reason}</span>
                <small>
                  {item.status === "approved" ? "Conciliada" : "Abierta"} |{" "}
                  {new Date(item.counted_at).toLocaleDateString("es-CO")}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aún no hay jornadas registradas.</p>
        )}
      </section>

      {openModal ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-count-title"
        >
          <div className="modal-card small">
            <div className="modal-header">
              <div>
                <p>Inventario inicial</p>
                <h3 id="open-count-title">Abrir jornada de bodega</h3>
              </div>
              <button
                className="btn-close-modal"
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpenModal(false)}
              >
                ×
              </button>
            </div>
            <p className="panel-intro">
              La fotografía incluirá todos los artículos actuales. Podrán
              trabajar varios días y los artículos nuevos quedarán en borrador
              hasta la conciliación.
            </p>
            <label className="form-group" htmlFor="count-branch">
              Sede
              <select
                id="count-branch"
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
              >
                <option value="">Selecciona una sede</option>
                {branches.map((branch) => (
                  <option key={branch.branch_id} value={branch.branch_id}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-group" htmlFor="count-kind">
              Tipo de conteo
              <select
                id="count-kind"
                value={countKind}
                onChange={(event) => setCountKind(event.target.value as "initial" | "periodic")}
              >
                <option value="initial">Inventario inicial</option>
                <option value="periodic">Conteo periódico</option>
              </select>
            </label>
            <label className="form-group" htmlFor="count-scope">
              Alcance
              <select
                id="count-scope"
                value={scopeType}
                onChange={(event) => setScopeType(event.target.value as "all" | "location" | "category")}
              >
                <option value="all">Toda la bodega</option>
                <option value="location">Por ubicación</option>
                <option value="category">Por categoría</option>
              </select>
            </label>
            {scopeType !== "all" ? (
              <label className="form-group" htmlFor="count-scope-value">
                Valor del alcance
                <input
                  id="count-scope-value"
                  value={scopeValue}
                  onChange={(event) => setScopeValue(event.target.value)}
                  placeholder={scopeType === "location" ? "Ej.: Bodega A" : "Ej.: Ferretería"}
                />
              </label>
            ) : null}
            <label className="form-group" htmlFor="count-reason">
              Observación de la jornada
              <input
                id="count-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej.: Inventario inicial octubre 2026"
              />
            </label>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                type="button"
                onClick={() => setOpenModal(false)}
              >
                Cancelar
              </button>
              <button
                className="inventory-action"
                type="button"
                disabled={isSaving}
                onClick={() => void openCount()}
              >
                {isSaving ? "Abriendo…" : "Abrir jornada"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedLine && lineDraft ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="count-line-title"
        >
          <div className="modal-card article-detail-modal count-line-modal">
            <div className="modal-header">
              <div>
                <p>Conteo físico</p>
                <h3 id="count-line-title">
                  {selectedLine.inventory_stock?.inventory_items?.name}
                </h3>
              </div>
              <button
                className="btn-close-modal"
                type="button"
                aria-label="Cerrar"
                onClick={() => {
                  setSelectedLine(null);
                  setLineDraft(null);
                }}
              >
                ×
              </button>
            </div>
            <p className="panel-intro">
              Saldo al abrir: <strong>{selectedLine.system_quantity}</strong>.
              Guarda 0 si el artículo no fue encontrado.
            </p>
            <div className="form-grid-2">
              <label className="form-group" htmlFor="count-quantity">
                Cantidad física
                <input
                  id="count-quantity"
                  autoFocus
                  type="number"
                  min="0"
                  step="any"
                  value={lineDraft.quantity}
                  onChange={(event) =>
                    setLineDraft({ ...lineDraft, quantity: event.target.value })
                  }
                />
              </label>
              <label className="form-group" htmlFor="count-location">
                Ubicación física
                <input
                  id="count-location"
                  value={lineDraft.location}
                  onChange={(event) =>
                    setLineDraft({ ...lineDraft, location: event.target.value })
                  }
                />
              </label>
              <label className="form-group" htmlFor="count-cost">
                Costo unitario COP (opcional)
                <input
                  id="count-cost"
                  type="number"
                  min="0"
                  step="any"
                  value={lineDraft.cost}
                  onChange={(event) =>
                    setLineDraft({ ...lineDraft, cost: event.target.value })
                  }
                />
              </label>
              <label className="form-group" htmlFor="count-notes">
                Notas
                <input
                  id="count-notes"
                  value={lineDraft.notes}
                  onChange={(event) =>
                    setLineDraft({ ...lineDraft, notes: event.target.value })
                  }
                />
              </label>
            </div>
            <section className="count-form-section" aria-labelledby="count-article-details">
              <h4 id="count-article-details">Ficha del artículo</h4>
              <p className="panel-intro">Puedes corregir estos datos durante el conteo. Se revisarán y aplicarán únicamente al conciliar la jornada.</p>
              <div className="form-grid-2">
                <label className="form-group" htmlFor="count-sku">SKU o código<input id="count-sku" value={lineDraft.item.sku} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, sku: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-name">Nombre del artículo<input id="count-name" value={lineDraft.item.name} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, name: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-category">Categoría<input id="count-category" value={lineDraft.item.category} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, category: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-brand">Marca<input id="count-brand" value={lineDraft.item.brand} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, brand: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-unit">Unidad<input id="count-unit" value={lineDraft.item.unit} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, unit: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-condition">Estado del activo<input id="count-condition" value={lineDraft.item.asset_condition} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, asset_condition: event.target.value } })} placeholder="Ej.: bueno, para reparar" /></label>
                <label className="form-group" htmlFor="count-reference">Referencia técnica<input id="count-reference" value={lineDraft.item.technical_reference} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, technical_reference: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-model">Modelo<input id="count-model" value={lineDraft.item.model} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, model: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-serial">Número de serie<input id="count-serial" value={lineDraft.item.serial_number} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, serial_number: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-minimum">Stock mínimo<input id="count-minimum" type="number" min="0" value={lineDraft.item.minimum_quantity} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, minimum_quantity: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-reorder">Punto de reposición<input id="count-reorder" type="number" min="0" value={lineDraft.item.reorder_quantity} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, reorder_quantity: event.target.value } })} /></label>
                <label className="form-group" htmlFor="count-purchase-unit">Unidad de compra<input id="count-purchase-unit" value={lineDraft.item.purchase_unit} onChange={(event) => setLineDraft({ ...lineDraft, item: { ...lineDraft.item, purchase_unit: event.target.value } })} /></label>
              </div>
            </section>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                type="button"
                onClick={() => {
                  setSelectedLine(null);
                  setLineDraft(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="inventory-action"
                type="button"
                disabled={isSaving}
                onClick={() => void saveLine()}
              >
                {isSaving ? "Guardando…" : "Guardar conteo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newItemOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-item-title"
        >
          <div className="modal-card article-detail-modal">
            <div className="modal-header">
              <div>
                <p>Hallazgo de inventario</p>
                <h3 id="new-item-title">Agregar artículo encontrado</h3>
              </div>
              <button
                className="btn-close-modal"
                type="button"
                aria-label="Cerrar"
                onClick={() => setNewItemOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="panel-intro">
              No entrará al inventario oficial hasta que se concilie la jornada.
            </p>
            <div className="form-grid-2">
              <label className="form-group" htmlFor="new-sku">
                SKU o código provisional
                <input
                  id="new-sku"
                  autoFocus
                  value={newItemDraft.sku}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      sku: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-group" htmlFor="new-name">
                Nombre
                <input
                  id="new-name"
                  value={newItemDraft.name}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      name: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-group" htmlFor="new-category">
                Categoría
                <input
                  id="new-category"
                  value={newItemDraft.category}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      category: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-group" htmlFor="new-brand">
                Marca
                <input
                  id="new-brand"
                  value={newItemDraft.brand}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      brand: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-group" htmlFor="new-unit">
                Unidad
                <input
                  id="new-unit"
                  value={newItemDraft.unit}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      unit: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-group" htmlFor="new-location">
                Ubicación
                <input
                  id="new-location"
                  value={newItemDraft.location}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      location: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-group" htmlFor="new-quantity">
                Cantidad física
                <input
                  id="new-quantity"
                  type="number"
                  min="0"
                  step="any"
                  value={newItemDraft.quantity}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      quantity: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-group" htmlFor="new-cost">
                Costo unitario COP (opcional)
                <input
                  id="new-cost"
                  type="number"
                  min="0"
                  step="any"
                  value={newItemDraft.cost}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      cost: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-group" htmlFor="new-notes">
                Notas
                <input
                  id="new-notes"
                  value={newItemDraft.notes}
                  onChange={(event) =>
                    setNewItemDraft({
                      ...newItemDraft,
                      notes: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                type="button"
                onClick={() => setNewItemOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="inventory-action"
                type="button"
                disabled={isSaving}
                onClick={() => void saveNewItem()}
              >
                {isSaving ? "Guardando…" : "Guardar hallazgo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {approvalOpen && session ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-count-title"
        >
          <div className="modal-card article-detail-modal">
            <div className="modal-header">
              <div>
                <p>Revisión final</p>
                <h3 id="approve-count-title">Conciliar inventario inicial</h3>
              </div>
              <button
                className="btn-close-modal"
                type="button"
                aria-label="Cerrar"
                onClick={() => setApprovalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="counts-reconciliation-grid">
              <p>
                <strong>
                  {countedLines.length} de {session.expected_line_count}
                </strong>
                <span>artículos contados</span>
              </p>
              <p>
                <strong>{differences.length}</strong>
                <span>diferencias frente al saldo inicial</span>
              </p>
              <p>
                <strong>{newItems.length}</strong>
                <span>artículos nuevos por crear</span>
              </p>
              <p>
                <strong>{pendingCosts}</strong>
                <span>registros sin costo confirmado</span>
              </p>
            </div>
            <p className="panel-intro">
              Al confirmar se bloqueará la jornada, se aplicarán los ajustes y
              los artículos nuevos pasarán oficialmente al inventario. El
              informe descargable conservará responsable, fecha y detalle de
              cada registro.
            </p>
            <div className="counts-contributors">
              <strong>Participantes</strong>
              {contributors.length ? (
                <ul>
                  {contributors.map(([name, count]) => (
                    <li key={name}>
                      {name}: {count} registro(s)
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <label className="counts-confirmation">
              <input
                type="checkbox"
                checked={approvalConfirmed}
                onChange={(event) => setApprovalConfirmed(event.target.checked)}
              />{" "}
              Confirmo que revisé el inventario físico y autorizo aplicar esta
              conciliación.
            </label>
            {differences.length > 0 ? (
              <label className="counts-confirmation">
                <input
                  type="checkbox"
                  checked={reviewedDifferences}
                  onChange={(event) => setReviewedDifferences(event.target.checked)}
                />{" "}
                Confirmo que revisé las {differences.length} diferencia(s) encontradas.
              </label>
            ) : null}
            <div className="modal-actions">
              <button
                className="btn-cancel"
                type="button"
                onClick={() => setApprovalOpen(false)}
              >
                Seguir contando
              </button>
              <button
                className="inventory-action"
                type="button"
                disabled={!approvalConfirmed || (differences.length > 0 && !reviewedDifferences) || isSaving}
                onClick={() => void approve()}
              >
                {isSaving ? "Conciliando…" : "Confirmar conciliación"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
