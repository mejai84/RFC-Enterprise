/* ─────────────────────────────────────────────────────────────
 * Módulo de Cotizaciones – Workspace (Presentación)
 * Tablero Kanban + Vista de lista + Detalle de ficha
 * ───────────────────────────────────────────────────────────── */
"use client";

import { useState, useMemo, useCallback, type FormEvent } from "react";
import {
  type Quote,
  type QuoteStatus,
  type QuoteHistoryEntry,
  quoteStatuses,
  kanbanColumns,
  getNextQuoteCode,
  getStatusMeta,
  isStale,
} from "@/modules/quotes";

/* ── Helpers de formato ─────────────────────────────────────── */

function formatCOP(value: number | undefined): string {
  if (value == null) return "—";
  return "$" + value.toLocaleString("es-CO");
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ── Componente principal ────────────────────────────────────── */

type ViewMode = "kanban" | "list";

export function QuotesWorkspace({ initialQuotes }: { initialQuotes: Quote[] }) {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [view, setView] = useState<ViewMode>("kanban");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  /* ── Resumen ────────────────────────────────────────────── */
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of quotes) counts[q.status] = (counts[q.status] || 0) + 1;
    return counts;
  }, [quotes]);

  const totalPipeline = useMemo(() => {
    return quotes
      .filter((q) => !["lost", "closed"].includes(q.status))
      .reduce((sum, q) => sum + (q.estimatedValue ?? 0), 0);
  }, [quotes]);

  /* ── Filtrado ───────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = quotes;
    if (filterStatus !== "all") result = result.filter((q) => q.status === filterStatus);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (q) =>
          q.title.toLowerCase().includes(term) ||
          q.code.toLowerCase().includes(term) ||
          q.client.toLowerCase().includes(term)
      );
    }
    return result;
  }, [quotes, filterStatus, searchTerm]);

  /* ── Cambiar estado ─────────────────────────────────────── */
  const changeStatus = useCallback((quoteId: string, newStatus: QuoteStatus, note?: string) => {
    setQuotes((prev) =>
      prev.map((q) => {
        if (q.id !== quoteId) return q;
        const entry: QuoteHistoryEntry = {
          id: uid(),
          fromStatus: q.status,
          toStatus: newStatus,
          changedBy: "Jorge Figueroa",
          changedAt: new Date().toISOString(),
          note,
        };
        return { ...q, status: newStatus, updatedAt: entry.changedAt, history: [...q.history, entry] };
      })
    );
    setSelectedQuote((prev) => {
      if (!prev || prev.id !== quoteId) return prev;
      const updated = quotes.find((q) => q.id === quoteId);
      if (!updated) return prev;
      const entry: QuoteHistoryEntry = {
        id: uid(),
        fromStatus: updated.status,
        toStatus: newStatus,
        changedBy: "Jorge Figueroa",
        changedAt: new Date().toISOString(),
        note,
      };
      return { ...updated, status: newStatus, updatedAt: entry.changedAt, history: [...updated.history, entry] };
    });
  }, [quotes]);

  /* ── Crear nueva cotización ────────────────────────────── */
  const handleCreateQuote = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    const client = String(fd.get("client") ?? "").trim();
    const contactName = String(fd.get("contactName") ?? "").trim();
    const contactEmail = String(fd.get("contactEmail") ?? "").trim();
    const contactPhone = String(fd.get("contactPhone") ?? "").trim();
    const estimatedStr = String(fd.get("estimatedValue") ?? "").replace(/\D/g, "");
    const deadline = String(fd.get("deadline") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();

    if (!title || !client) return;

    const code = getNextQuoteCode(quotes);
    const now = new Date().toISOString();
    const newQuote: Quote = {
      id: uid(),
      code,
      title,
      client,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      status: "received",
      responsible: "Jorge Figueroa",
      estimatedValue: estimatedStr ? Number(estimatedStr) : undefined,
      receivedAt: now.slice(0, 10),
      deadline: deadline || undefined,
      notes: notes || undefined,
      nextAction: "Revisar alcance y documentación",
      history: [
        { id: uid(), fromStatus: null, toStatus: "received", changedBy: "Sistema", changedAt: now, note: "Solicitud registrada manualmente" },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setQuotes((prev) => [newQuote, ...prev]);
    setShowNewForm(false);
  }, [quotes]);

  return (
    <div className="quotes-workspace">
      {/* ── Header ────────────────────────────────────── */}
      <header className="quotes-header">
        <div className="quotes-header-left">
          <h1>Cotizaciones y Pipeline</h1>
          <p className="quotes-subtitle">
            {quotes.length} oportunidades · Pipeline activo: <strong>{formatCOP(totalPipeline)}</strong>
          </p>
        </div>
        <div className="quotes-header-actions">
          <div className="quotes-view-toggle">
            <button className={`quotes-toggle-btn ${view === "kanban" ? "active" : ""}`} onClick={() => setView("kanban")}>
              <KanbanIcon /> Kanban
            </button>
            <button className={`quotes-toggle-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>
              <ListIcon /> Lista
            </button>
          </div>
          <button className="quotes-new-btn" onClick={() => setShowNewForm(true)}>
            + Nueva solicitud
          </button>
        </div>
      </header>

      {/* ── Resumen rápido ────────────────────────────── */}
      <div className="quotes-summary-bar">
        {quoteStatuses.filter((s) => !["revision_requested", "work_completed"].includes(s.value)).map((s) => (
          <button
            key={s.value}
            className={`quotes-summary-chip ${filterStatus === s.value ? "active" : ""}`}
            style={{ "--chip-color": s.color } as React.CSSProperties}
            onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value as QuoteStatus)}
          >
            <span className="chip-icon">{s.icon}</span>
            <span className="chip-count">{summary[s.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ── Buscador ─────────────────────────────────── */}
      <div className="quotes-search-bar">
        <input
          type="search"
          placeholder="Buscar por título, código o cliente…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="quotes-search-input"
        />
        {filterStatus !== "all" && (
          <button className="quotes-clear-filter" onClick={() => setFilterStatus("all")}>
            Mostrar todo ✕
          </button>
        )}
      </div>

      {/* ── Vista Kanban / Lista ──────────────────────── */}
      {view === "kanban" ? (
        <KanbanBoard quotes={filtered} onSelect={setSelectedQuote} onStatusChange={changeStatus} />
      ) : (
        <ListView quotes={filtered} onSelect={setSelectedQuote} onStatusChange={changeStatus} />
      )}

      {/* ── Modal detalle ─────────────────────────────── */}
      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onStatusChange={changeStatus}
        />
      )}

      {/* ── Modal nueva solicitud ─────────────────────── */}
      {showNewForm && (
        <NewQuoteModal onSubmit={handleCreateQuote} onClose={() => setShowNewForm(false)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * KANBAN BOARD
 * ═══════════════════════════════════════════════════════════════ */

function KanbanBoard({
  quotes,
  onSelect,
  onStatusChange,
}: {
  quotes: Quote[];
  onSelect: (q: Quote) => void;
  onStatusChange: (id: string, status: QuoteStatus, note?: string) => void;
}) {
  return (
    <div className="kanban-board">
      {kanbanColumns.map((colStatus) => {
        const meta = getStatusMeta(colStatus);
        const cards = quotes.filter((q) => q.status === colStatus);
        return (
          <div className="kanban-column" key={colStatus}>
            <div className="kanban-column-header" style={{ "--col-color": meta.color } as React.CSSProperties}>
              <span className="kanban-col-icon">{meta.icon}</span>
              <span className="kanban-col-label">{meta.label}</span>
              <span className="kanban-col-count">{cards.length}</span>
            </div>
            <div className="kanban-column-body">
              {cards.length === 0 && <div className="kanban-empty">Sin solicitudes</div>}
              {cards.map((q) => (
                <KanbanCard key={q.id} quote={q} onSelect={onSelect} onStatusChange={onStatusChange} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  quote,
  onSelect,
  onStatusChange,
}: {
  quote: Quote;
  onSelect: (q: Quote) => void;
  onStatusChange: (id: string, status: QuoteStatus, note?: string) => void;
}) {
  const stale = isStale(quote);
  const meta = getStatusMeta(quote.status);
  const statusIdx = quoteStatuses.findIndex((s) => s.value === quote.status);
  const nextStatus = statusIdx < quoteStatuses.length - 2 ? quoteStatuses[statusIdx + 1] : null;

  return (
    <article
      className={`kanban-card ${stale ? "kanban-card--stale" : ""}`}
      onClick={() => onSelect(quote)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(quote); }}
    >
      <div className="kanban-card-top">
        <span className="kanban-card-code">{quote.code}</span>
        {stale && <span className="kanban-stale-badge" title="Más de 3 días sin respuesta">⚠️</span>}
      </div>
      <h3 className="kanban-card-title">{quote.title}</h3>
      <p className="kanban-card-client">{quote.client}</p>
      <div className="kanban-card-meta">
        {quote.estimatedValue != null && <span className="kanban-card-value">{formatCOP(quote.estimatedValue)}</span>}
        {quote.deadline && <span className="kanban-card-deadline">📅 {formatDate(quote.deadline)}</span>}
      </div>
      {quote.nextAction && <p className="kanban-card-action">→ {quote.nextAction}</p>}
      {nextStatus && quote.status !== "closed" && quote.status !== "lost" && (
        <button
          className="kanban-card-advance"
          style={{ "--adv-color": nextStatus.color } as React.CSSProperties}
          onClick={(e) => { e.stopPropagation(); onStatusChange(quote.id, nextStatus.value as QuoteStatus); }}
          title={`Mover a ${nextStatus.label}`}
        >
          {nextStatus.icon} {nextStatus.label} →
        </button>
      )}
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * LIST VIEW
 * ═══════════════════════════════════════════════════════════════ */

function ListView({
  quotes,
  onSelect,
  onStatusChange,
}: {
  quotes: Quote[];
  onSelect: (q: Quote) => void;
  onStatusChange: (id: string, status: QuoteStatus, note?: string) => void;
}) {
  return (
    <div className="quotes-list-container">
      <table className="quotes-list-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Solicitud</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Valor est.</th>
            <th>Recibido</th>
            <th>Límite</th>
            <th>Próxima acción</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const meta = getStatusMeta(q.status);
            const stale = isStale(q);
            return (
              <tr key={q.id} className={stale ? "row-stale" : ""} onClick={() => onSelect(q)} style={{ cursor: "pointer" }}>
                <td className="cell-code">{q.code}</td>
                <td className="cell-title">{q.title}</td>
                <td>{q.client}</td>
                <td>
                  <span className="status-badge" style={{ "--badge-color": meta.color } as React.CSSProperties}>
                    {meta.icon} {meta.label}
                  </span>
                  {stale && <span className="stale-tag">⚠️ +3d</span>}
                </td>
                <td className="cell-value">{formatCOP(q.estimatedValue)}</td>
                <td>{formatDate(q.receivedAt)}</td>
                <td>{formatDate(q.deadline)}</td>
                <td className="cell-action">{q.nextAction || "—"}</td>
                <td>
                  <select
                    className="status-select"
                    value={q.status}
                    onChange={(e) => { e.stopPropagation(); onStatusChange(q.id, e.target.value as QuoteStatus); }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {quoteStatuses.map((s) => (
                      <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {quotes.length === 0 && <p className="quotes-empty">No hay cotizaciones que coincidan con el filtro.</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * DETAIL MODAL
 * ═══════════════════════════════════════════════════════════════ */

function QuoteDetailModal({
  quote,
  onClose,
  onStatusChange,
}: {
  quote: Quote;
  onClose: () => void;
  onStatusChange: (id: string, status: QuoteStatus, note?: string) => void;
}) {
  const meta = getStatusMeta(quote.status);
  const [note, setNote] = useState("");

  return (
    <div className="quote-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Detalle de ${quote.code}`}>
      <div className="quote-modal" onClick={(e) => e.stopPropagation()}>
        <header className="quote-modal-header">
          <div>
            <span className="quote-modal-code">{quote.code}</span>
            <span className="status-badge" style={{ "--badge-color": meta.color } as React.CSSProperties}>
              {meta.icon} {meta.label}
            </span>
          </div>
          <button className="quote-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        <h2 className="quote-modal-title">{quote.title}</h2>

        <div className="quote-modal-grid">
          <Field label="Cliente" value={quote.client} />
          <Field label="Contacto" value={quote.contactName} />
          <Field label="Correo" value={quote.contactEmail} />
          <Field label="Teléfono" value={quote.contactPhone} />
          <Field label="Responsable" value={quote.responsible} />
          <Field label="Valor estimado" value={formatCOP(quote.estimatedValue)} />
          <Field label="Recibido" value={formatDate(quote.receivedAt)} />
          <Field label="Fecha límite" value={formatDate(quote.deadline)} />
          {quote.projectCode && <Field label="Obra vinculada" value={quote.projectCode} />}
        </div>

        {quote.nextAction && (
          <div className="quote-modal-next-action">
            <strong>→ Próxima acción:</strong> {quote.nextAction}
          </div>
        )}

        {quote.notes && (
          <div className="quote-modal-notes">
            <strong>Observaciones:</strong> {quote.notes}
          </div>
        )}

        {/* ── Cambiar estado ───────────────────────── */}
        <div className="quote-modal-status-change">
          <label className="quote-modal-label">Cambiar estado</label>
          <div className="quote-modal-status-row">
            <select
              className="status-select"
              defaultValue={quote.status}
              id="modal-status-select"
            >
              {quoteStatuses.map((s) => (
                <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
              ))}
            </select>
            <input
              type="text"
              className="quote-modal-note-input"
              placeholder="Nota del cambio (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="quotes-new-btn"
              onClick={() => {
                const sel = (document.getElementById("modal-status-select") as HTMLSelectElement).value as QuoteStatus;
                if (sel !== quote.status) {
                  onStatusChange(quote.id, sel, note || undefined);
                  setNote("");
                  onClose();
                }
              }}
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* ── Historial ───────────────────────────────── */}
        <div className="quote-modal-history">
          <h3>Historial de cambios</h3>
          <div className="quote-history-timeline">
            {[...quote.history].reverse().map((entry) => {
              const toMeta = getStatusMeta(entry.toStatus);
              const fromMeta = entry.fromStatus ? getStatusMeta(entry.fromStatus) : null;
              return (
                <div className="history-entry" key={entry.id}>
                  <div className="history-dot" style={{ background: toMeta.color }} />
                  <div className="history-content">
                    <div className="history-meta">
                      <strong>{entry.changedBy}</strong>
                      <span className="history-date">{formatDateTime(entry.changedAt)}</span>
                    </div>
                    <p className="history-change">
                      {fromMeta ? (
                        <>{fromMeta.icon} {fromMeta.label} → {toMeta.icon} {toMeta.label}</>
                      ) : (
                        <>{toMeta.icon} {toMeta.label}</>
                      )}
                    </p>
                    {entry.note && <p className="history-note">{entry.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="quote-field">
      <span className="quote-field-label">{label}</span>
      <span className="quote-field-value">{value || "—"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * NEW QUOTE MODAL
 * ═══════════════════════════════════════════════════════════════ */

function NewQuoteModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="quote-modal-backdrop" onClick={onClose}>
      <div className="quote-modal quote-modal--new" onClick={(e) => e.stopPropagation()}>
        <header className="quote-modal-header">
          <h2>Nueva solicitud de cotización</h2>
          <button className="quote-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <form onSubmit={onSubmit} className="new-quote-form">
          <label className="form-field">
            Título / Descripción de la solicitud *
            <input name="title" type="text" required placeholder="Ej: Reparación chimenea CCM Caucasia" />
          </label>
          <label className="form-field">
            Cliente *
            <input name="client" type="text" required placeholder="Ej: OCENSA" />
          </label>
          <div className="new-quote-row">
            <label className="form-field">
              Nombre de contacto
              <input name="contactName" type="text" placeholder="Ej: Andrés Gómez" />
            </label>
            <label className="form-field">
              Correo de contacto
              <input name="contactEmail" type="email" placeholder="correo@empresa.com" />
            </label>
          </div>
          <div className="new-quote-row">
            <label className="form-field">
              Teléfono
              <input name="contactPhone" type="tel" placeholder="+57 310 000 0000" />
            </label>
            <label className="form-field">
              Valor estimado (COP)
              <input name="estimatedValue" type="text" placeholder="18.500.000" />
            </label>
          </div>
          <label className="form-field">
            Fecha límite de entrega
            <input name="deadline" type="date" />
          </label>
          <label className="form-field">
            Observaciones
            <textarea name="notes" rows={3} placeholder="Planos recibidos, alcance preliminar, etc." />
          </label>
          <div className="new-quote-actions">
            <button type="button" className="quotes-cancel-btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="quotes-new-btn">📥 Registrar solicitud</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * MINI ICONS
 * ═══════════════════════════════════════════════════════════════ */

function KanbanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="4" height="12" rx="1" />
      <rect x="6" y="2" width="4" height="8" rx="1" />
      <rect x="11" y="2" width="4" height="10" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 4h10M4 8h10M4 12h10M1.5 4h.01M1.5 8h.01M1.5 12h.01" />
    </svg>
  );
}
