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
type LineDraft = { quantity: string; location: string; cost: string; notes: string };
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
  sku: "", name: "", category: "", brand: "", unit: "unidad", location: "",
  quantity: "", cost: "", notes: "",
};

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function CountsWorkspace() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [session, setSession] = useState<CountSession | null>(null);
  const [history, setHistory] = useState<CountSession[]>([]);
  const [lines, setLines] = useState<CountLine[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedLine, setSelectedLine] = useState<CountLine | null>(null);
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemDraft, setNewItemDraft] = useState<NewItemDraft>(emptyNewItem);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);

  const client = () =>
    isSupabaseConfigured && supabaseUrl && supabasePublishableKey
      ? createBrowserClient(supabaseUrl, supabasePublishableKey)
      : null;

  async function loadSession(target?: CountSession | null) {
    const supabase = client();
    const active = target ?? session;
    if (!supabase || !active) return;
    const [{ data: lineData, error: lineError }, { data: newItemData, error: newItemError }] = await Promise.all([
      supabase
        .from("physical_count_lines")
        .select("id,stock_id,system_quantity,counted_quantity,counted_location,unit_cost,notes,counted_by,counted_by_name,counted_at,inventory_stock(location,inventory_items(sku,name,category,unit))")
        .eq("count_id", active.id)
        .order("counted_at", { ascending: true, nullsFirst: true }),
      supabase
        .from("physical_count_new_items")
        .select("id,sku,name,category,brand,unit,location,counted_quantity,unit_cost,notes,status,counted_by_name,counted_at")
        .eq("count_id", active.id)
        .order("created_at"),
    ]);
    if (lineError || newItemError) {
      setStatus(lineError?.message ?? newItemError?.message ?? "No fue posible cargar la jornada.");
      return;
    }
    const normalizedLines = (lineData ?? []).map((row) => {
      const stock = Array.isArray(row.inventory_stock)
        ? row.inventory_stock[0] ?? null
        : row.inventory_stock;
      const item = stock
        ? Array.isArray(stock.inventory_items)
          ? stock.inventory_items[0] ?? null
          : stock.inventory_items ?? null
        : null;
      return {
        ...row,
        inventory_stock: stock ? { ...stock, inventory_items: item } : null,
      };
    });
    setLines(normalizedLines as CountLine[]);
    setNewItems((newItemData ?? []) as NewItem[]);
  }

  async function loadWorkspace() {
    const supabase = client();
    if (!supabase) {
      setStatus("Supabase no est? configurado para registrar conteos.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [{ data: branchData, error: branchError }, { data: sessionData, error: sessionError }] = await Promise.all([
      supabase.rpc("inventory_count_branches"),
      supabase
        .from("physical_counts")
        .select("id,reason,status,count_kind,scope_type,scope_value,expected_line_count,counted_at,approved_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    if (branchError || sessionError) {
      setStatus(branchError?.message ?? sessionError?.message ?? "No fue posible cargar Conteos f?sicos.");
      setIsLoading(false);
      return;
    }
    const sessions = (sessionData ?? []) as CountSession[];
    const active = sessions.find((item) => item.status === "draft") ?? null;
    setBranches((branchData ?? []) as Branch[]);
    setHistory(sessions);
    setSession(active);
    if (active) await loadSession(active);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

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
  const pendingLines = lines.length - countedLines.length;
  const progress = session?.expected_line_count
    ? Math.round((countedLines.length / session.expected_line_count) * 100)
    : 0;
  const filteredLines = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-CO");
    if (!normalized) return lines;
    return lines.filter((line) => {
      const item = line.inventory_stock?.inventory_items;
      return `${item?.name ?? ""} ${item?.sku ?? ""} ${item?.category ?? ""}`
        .toLocaleLowerCase("es-CO")
        .includes(normalized);
    });
  }, [lines, query]);
  const pagedLines = filteredLines.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
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
  const differences = countedLines.filter((line) => line.counted_quantity !== line.system_quantity);
  const pendingCosts = [...countedLines, ...newItems].filter((item) => item.unit_cost === null).length;

  async function openCount() {
    const supabase = client();
    const branch = branches[0];
    if (!supabase || !branch) {
      setStatus("No tienes una sede de inventario habilitada para abrir la jornada.");
      return;
    }
    setIsSaving(true);
    const { data, error } = await supabase.rpc("open_physical_count", {
      p_branch_id: branch.branch_id,
      p_scope_type: "all",
      p_scope_value: null,
      p_reason: reason.trim() || null,
      p_count_kind: "initial",
    });
    setIsSaving(false);
    if (error || !data) {
      setStatus(error?.message ?? "No fue posible abrir la jornada.");
      return;
    }
    setOpenModal(false);
    setReason("");
    setStatus("Jornada abierta. Cada guardado queda persistido como borrador hasta la conciliaci?n final.");
    await loadWorkspace();
  }

  function editLine(line: CountLine) {
    setSelectedLine(line);
    setLineDraft({
      quantity: line.counted_quantity?.toString() ?? "",
      location: line.counted_location ?? line.inventory_stock?.location ?? "",
      cost: line.unit_cost?.toString() ?? "",
      notes: line.notes ?? "",
    });
  }

  async function saveLine() {
    const supabase = client();
    if (!supabase || !session || !selectedLine || !lineDraft) return;
    const quantity = numberOrNull(lineDraft.quantity);
    const cost = numberOrNull(lineDraft.cost);
    if (quantity === null || quantity < 0) {
      setStatus("Indica una cantidad f?sica v?lida, incluido 0 cuando no se encontr? existencia.");
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
    });
    setIsSaving(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Conteo guardado en la jornada. A?n no cambia el inventario oficial.");
    setSelectedLine(null);
    setLineDraft(null);
    await loadSession(session);
  }

  async function saveNewItem() {
    const supabase = client();
    if (!supabase || !session) return;
    const quantity = numberOrNull(newItemDraft.quantity);
    const cost = numberOrNull(newItemDraft.cost);
    if (!newItemDraft.sku.trim() || !newItemDraft.name.trim() || !newItemDraft.unit.trim() || quantity === null || quantity < 0) {
      setStatus("El art?culo nuevo requiere SKU, nombre, unidad y cantidad f?sica v?lida.");
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
      setStatus(error.message);
      return;
    }
    setNewItemOpen(false);
    setNewItemDraft(emptyNewItem);
    setStatus("Art?culo nuevo guardado como hallazgo de la jornada. Se crear? oficialmente al conciliar.");
    await loadSession(session);
  }

  async function approve() {
    const supabase = client();
    if (!supabase || !session || pendingLines > 0 || !approvalConfirmed) return;
    setIsSaving(true);
    const { error } = await supabase.rpc("approve_physical_count", { target_count: session.id });
    setIsSaving(false);
    if (error) {
      setStatus(error.message);
      setApprovalOpen(false);
      return;
    }
    setApprovalOpen(false);
    setApprovalConfirmed(false);
    setStatus("Jornada conciliada. El inventario oficial, los movimientos y la auditor?a fueron actualizados.");
    await loadWorkspace();
  }

  function downloadReport() {
    if (!session) return;
    const rows = [
      ["Tipo", "SKU", "Art?culo", "Sistema", "F?sico", "Ubicaci?n", "Costo", "Cont?", "Fecha", "Notas"],
      ...lines.map((line) => [
        "Existente", line.inventory_stock?.inventory_items?.sku ?? "", line.inventory_stock?.inventory_items?.name ?? "",
        line.system_quantity, line.counted_quantity ?? "Pendiente", line.counted_location ?? line.inventory_stock?.location ?? "",
        line.unit_cost ?? "Pendiente", line.counted_by_name ?? "", line.counted_at ?? "", line.notes ?? "",
      ]),
      ...newItems.map((item) => [
        "Nuevo", item.sku, item.name, 0, item.counted_quantity, item.location ?? "", item.unit_cost ?? "Pendiente",
        item.counted_by_name ?? "", item.counted_at, item.notes ?? "",
      ]),
    ];
    const content = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
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
          <p>Operaciones ? RFC Enterprise</p>
          <h1>Inventario f?sico inicial</h1>
          <small>Una sola jornada para toda la bodega. Cada persona guarda sus conteos y el inventario se vuelve oficial solo al conciliar el 100 %.</small>
        </div>
        <div className="counts-heading-actions">
          {session ? <span className="count-session-badge">Jornada abierta</span> : null}
          {!session ? <button className="inventory-action" type="button" onClick={() => setOpenModal(true)}>Abrir jornada</button> : null}
          {session ? <button className="btn-cancel" type="button" onClick={() => setNewItemOpen(true)}>Agregar art?culo encontrado</button> : null}
          {session ? <button className="inventory-action" type="button" disabled={pendingLines > 0 || isSaving} onClick={() => { setApprovalConfirmed(false); setApprovalOpen(true); }}>Cerrar y conciliar</button> : null}
        </div>
      </section>

      <section className="dashboard-panel counts-progress-panel" aria-live="polite">
        {isLoading ? <p className="panel-intro">Cargando la jornada de conteo?</p> : session ? <>
          <div className="counts-progress-heading">
            <div><strong>{session.reason}</strong><small>{session.scope_type === "all" ? "Toda la bodega" : session.scope_value}</small></div>
            <strong>{countedLines.length} de {session.expected_line_count} art?culos contados ? {progress}%</strong>
          </div>
          <div className="counts-progress-track" aria-label={`${progress}% del inventario contado`}><span style={{ width: `${progress}%` }} /></div>
          <p className="panel-intro">{pendingLines ? `Faltan ${pendingLines} art?culo(s). Registra 0 cuando no exista f?sicamente.` : "Cobertura completa. Revisa el resumen y concilia cuando est?s listo."}</p>
        </> : <p className="panel-intro">Abre la jornada inicial cuando el equipo vaya a comenzar. Los conteos se conservar?n durante los d?as que necesiten.</p>}
        {status ? <p className="counts-status" role="status">{status}</p> : null}
      </section>

      {session ? <>
        <section className="dashboard-panel">
          <div className="inventory-catalog-controls">
            <label className="search-field" htmlFor="count-search">Buscar art?culo
              <input id="count-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Nombre, SKU o categor?a" />
            </label>
            <div className="counts-table-summary"><strong>{filteredLines.length}</strong><span>art?culos visibles</span></div>
          </div>
          <div className="inventory-table-container">
            <table className="inventory-data-table">
              <thead><tr><th>Art?culo</th><th>Ubicaci?n</th><th>Saldo al abrir</th><th>Cantidad f?sica</th><th>Registr?</th><th>Estado</th></tr></thead>
              <tbody>{pagedLines.map((line) => {
                const item = line.inventory_stock?.inventory_items;
                const saved = line.counted_quantity !== null;
                return <tr key={line.id}>
                  <td><button className="table-link-button" type="button" onClick={() => editLine(line)}><strong>{item?.name ?? "Art?culo sin ficha"}</strong><small>{item?.sku ?? "Sin SKU"} ? {item?.unit ?? "unidad"}</small></button></td>
                  <td>{line.counted_location ?? line.inventory_stock?.location ?? "Sin ubicaci?n"}</td>
                  <td>{line.system_quantity}</td><td>{saved ? line.counted_quantity : "Sin registrar"}</td>
                  <td>{line.counted_by_name ?? "?"}</td><td><span className={`count-line-status ${saved ? "is-counted" : ""}`}>{saved ? "Registrado" : "Pendiente"}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {totalPages > 1 ? <div className="counts-pagination"><button className="btn-cancel" type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>P?gina {page + 1} de {totalPages}</span><button className="btn-cancel" type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div> : null}
        </section>

        <section className="counts-history" aria-label="Hallazgos y responsables">
          <div className="counts-report-header"><strong>Equipo y hallazgos</strong><button className="btn-cancel" type="button" onClick={downloadReport}>Descargar informe CSV</button></div>
          <p>{newItems.length} art?culo(s) nuevos encontrados ? {pendingCosts} registro(s) sin costo declarado.</p>
          {contributors.length ? <ul>{contributors.map(([name, count]) => <li key={name}><span>{name}</span><small>{count} registro(s) guardados</small></li>)}</ul> : <p>A?n no hay art?culos registrados.</p>}
        </section>
      </> : null}

      <section className="counts-history" aria-label="Historial de jornadas"><strong>?ltimas jornadas</strong>{history.length ? <ul>{history.slice(0, 4).map((item) => <li key={item.id}><span>{item.reason}</span><small>{item.status === "approved" ? "Conciliada" : "Abierta"} ? {new Date(item.counted_at).toLocaleDateString("es-CO")}</small></li>)}</ul> : <p>A?n no hay jornadas registradas.</p>}</section>

      {openModal ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="open-count-title"><div className="modal-card small"><div className="modal-header"><div><p>Inventario inicial</p><h3 id="open-count-title">Abrir jornada de bodega</h3></div><button className="btn-close-modal" type="button" aria-label="Cerrar" onClick={() => setOpenModal(false)}>?</button></div><p className="panel-intro">La fotograf?a incluir? todos los art?culos actuales. Podr?n trabajar varios d?as y los art?culos nuevos quedar?n en borrador hasta la conciliaci?n.</p><label className="form-group" htmlFor="count-reason">Observaci?n de la jornada<input id="count-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: Inventario inicial octubre 2026" /></label><div className="modal-actions"><button className="btn-cancel" type="button" onClick={() => setOpenModal(false)}>Cancelar</button><button className="inventory-action" type="button" disabled={isSaving} onClick={() => void openCount()}>{isSaving ? "Abriendo?" : "Abrir jornada"}</button></div></div></div> : null}

      {selectedLine && lineDraft ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="count-line-title"><div className="modal-card small"><div className="modal-header"><div><p>Conteo f?sico</p><h3 id="count-line-title">{selectedLine.inventory_stock?.inventory_items?.name}</h3></div><button className="btn-close-modal" type="button" aria-label="Cerrar" onClick={() => { setSelectedLine(null); setLineDraft(null); }}>?</button></div><p className="panel-intro">Saldo al abrir: <strong>{selectedLine.system_quantity}</strong>. Guarda 0 si el art?culo no fue encontrado.</p><div className="form-grid-2"><label className="form-group" htmlFor="count-quantity">Cantidad f?sica<input id="count-quantity" autoFocus type="number" min="0" step="any" value={lineDraft.quantity} onChange={(event) => setLineDraft({ ...lineDraft, quantity: event.target.value })} /></label><label className="form-group" htmlFor="count-location">Ubicaci?n f?sica<input id="count-location" value={lineDraft.location} onChange={(event) => setLineDraft({ ...lineDraft, location: event.target.value })} /></label><label className="form-group" htmlFor="count-cost">Costo unitario COP (opcional)<input id="count-cost" type="number" min="0" step="any" value={lineDraft.cost} onChange={(event) => setLineDraft({ ...lineDraft, cost: event.target.value })} /></label><label className="form-group" htmlFor="count-notes">Notas<input id="count-notes" value={lineDraft.notes} onChange={(event) => setLineDraft({ ...lineDraft, notes: event.target.value })} /></label></div><div className="modal-actions"><button className="btn-cancel" type="button" onClick={() => { setSelectedLine(null); setLineDraft(null); }}>Cancelar</button><button className="inventory-action" type="button" disabled={isSaving} onClick={() => void saveLine()}>{isSaving ? "Guardando?" : "Guardar conteo"}</button></div></div></div> : null}

      {newItemOpen ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-item-title"><div className="modal-card article-detail-modal"><div className="modal-header"><div><p>Hallazgo de inventario</p><h3 id="new-item-title">Agregar art?culo encontrado</h3></div><button className="btn-close-modal" type="button" aria-label="Cerrar" onClick={() => setNewItemOpen(false)}>?</button></div><p className="panel-intro">No entrar? al inventario oficial hasta que se concilie la jornada.</p><div className="form-grid-2"><label className="form-group" htmlFor="new-sku">SKU o c?digo provisional<input id="new-sku" autoFocus value={newItemDraft.sku} onChange={(event) => setNewItemDraft({ ...newItemDraft, sku: event.target.value })} /></label><label className="form-group" htmlFor="new-name">Nombre<input id="new-name" value={newItemDraft.name} onChange={(event) => setNewItemDraft({ ...newItemDraft, name: event.target.value })} /></label><label className="form-group" htmlFor="new-category">Categor?a<input id="new-category" value={newItemDraft.category} onChange={(event) => setNewItemDraft({ ...newItemDraft, category: event.target.value })} /></label><label className="form-group" htmlFor="new-brand">Marca<input id="new-brand" value={newItemDraft.brand} onChange={(event) => setNewItemDraft({ ...newItemDraft, brand: event.target.value })} /></label><label className="form-group" htmlFor="new-unit">Unidad<input id="new-unit" value={newItemDraft.unit} onChange={(event) => setNewItemDraft({ ...newItemDraft, unit: event.target.value })} /></label><label className="form-group" htmlFor="new-location">Ubicaci?n<input id="new-location" value={newItemDraft.location} onChange={(event) => setNewItemDraft({ ...newItemDraft, location: event.target.value })} /></label><label className="form-group" htmlFor="new-quantity">Cantidad f?sica<input id="new-quantity" type="number" min="0" step="any" value={newItemDraft.quantity} onChange={(event) => setNewItemDraft({ ...newItemDraft, quantity: event.target.value })} /></label><label className="form-group" htmlFor="new-cost">Costo unitario COP (opcional)<input id="new-cost" type="number" min="0" step="any" value={newItemDraft.cost} onChange={(event) => setNewItemDraft({ ...newItemDraft, cost: event.target.value })} /></label><label className="form-group" htmlFor="new-notes">Notas<input id="new-notes" value={newItemDraft.notes} onChange={(event) => setNewItemDraft({ ...newItemDraft, notes: event.target.value })} /></label></div><div className="modal-actions"><button className="btn-cancel" type="button" onClick={() => setNewItemOpen(false)}>Cancelar</button><button className="inventory-action" type="button" disabled={isSaving} onClick={() => void saveNewItem()}>{isSaving ? "Guardando?" : "Guardar hallazgo"}</button></div></div></div> : null}

      {approvalOpen && session ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="approve-count-title"><div className="modal-card article-detail-modal"><div className="modal-header"><div><p>Revisi?n final</p><h3 id="approve-count-title">Conciliar inventario inicial</h3></div><button className="btn-close-modal" type="button" aria-label="Cerrar" onClick={() => setApprovalOpen(false)}>?</button></div><div className="counts-reconciliation-grid"><p><strong>{countedLines.length} de {session.expected_line_count}</strong><span>art?culos contados</span></p><p><strong>{differences.length}</strong><span>diferencias frente al saldo inicial</span></p><p><strong>{newItems.length}</strong><span>art?culos nuevos por crear</span></p><p><strong>{pendingCosts}</strong><span>registros sin costo confirmado</span></p></div><p className="panel-intro">Al confirmar se bloquear? la jornada, se aplicar?n los ajustes y los art?culos nuevos pasar?n oficialmente al inventario. El informe descargable conservar? responsable, fecha y detalle de cada registro.</p><div className="counts-contributors"><strong>Participantes</strong>{contributors.length ? <ul>{contributors.map(([name, count]) => <li key={name}>{name}: {count} registro(s)</li>)}</ul> : null}</div><label className="counts-confirmation"><input type="checkbox" checked={approvalConfirmed} onChange={(event) => setApprovalConfirmed(event.target.checked)} /> Confirmo que revis? el inventario f?sico y autorizo aplicar esta conciliaci?n.</label><div className="modal-actions"><button className="btn-cancel" type="button" onClick={() => setApprovalOpen(false)}>Seguir contando</button><button className="inventory-action" type="button" disabled={!approvalConfirmed || isSaving} onClick={() => void approve()}>{isSaving ? "Conciliando?" : "Confirmar conciliaci?n"}</button></div></div></div> : null}
    </main>
  );
}
