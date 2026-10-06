/* ─────────────────────────────────────────────────────────────
 * Módulo de Cotizaciones – Workspace (Presentación)
 * Tablero Kanban + Vista de lista + Detalle de ficha +
 * Pre-costeo por 3 rubros + Visita técnica + Revisiones R1/R2 +
 * Conversión a Obra 1-Click + Propuesta Comercial Imprimible en PDF
 * ───────────────────────────────────────────────────────────── */
"use client";

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  type Quote,
  type QuoteStatus,
  type QuoteHistoryEntry,
  type QuoteCostBreakdown,
  type TechnicalVisit,
  quoteStatuses,
  kanbanColumns,
  getNextQuoteCode,
  getEffectiveQuoteCode,
  getStatusMeta,
  getOfferExpiry,
  calculateTotalCost,
  isStale,
  loadQuotesWorkspaceData,
  saveQuote,
  convertQuoteToProject,
} from "@/modules/quotes";

import { apuCostBreakdown, apuSellingBreakdown, type Apu } from "@/modules/apu";
import { prepareRealDataStorage } from "@/shared/browser/real-data-storage";

/* ── Helpers de formato ─────────────────────────────────────── */

function formatCOP(value: number | undefined): string {
  if (value == null) return "—";
  return "$" + value.toLocaleString("es-CO");
}

function formatCompactCOP(value: number | undefined): string {
  if (value == null || value === 0) return "—";
  if (value >= 1_000_000) {
    const mill = (value / 1_000_000).toFixed(1).replace(".0", "");
    return `$${mill}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}k`;
  }
  return `$${value}`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Convierte valores enteros COP a la leyenda comercial exigida en la propuesta. */
function amountInColombianPesos(value: number): string {
  const units = [
    "",
    "UNO",
    "DOS",
    "TRES",
    "CUATRO",
    "CINCO",
    "SEIS",
    "SIETE",
    "OCHO",
    "NUEVE",
  ];
  const teens = [
    "DIEZ",
    "ONCE",
    "DOCE",
    "TRECE",
    "CATORCE",
    "QUINCE",
    "DIECISÉIS",
    "DIECISIETE",
    "DIECIOCHO",
    "DIECINUEVE",
  ];
  const tens = [
    "",
    "",
    "VEINTE",
    "TREINTA",
    "CUARENTA",
    "CINCUENTA",
    "SESENTA",
    "SETENTA",
    "OCHENTA",
    "NOVENTA",
  ];
  const hundreds = [
    "",
    "CIENTO",
    "DOSCIENTOS",
    "TRESCIENTOS",
    "CUATROCIENTOS",
    "QUINIENTOS",
    "SEISCIENTOS",
    "SETECIENTOS",
    "OCHOCIENTOS",
    "NOVECIENTOS",
  ];
  const underThousand = (number: number): string => {
    if (number === 0) return "";
    if (number === 100) return "CIEN";
    const hundred = Math.floor(number / 100);
    const rest = number % 100;
    const result = hundred ? hundreds[hundred] : "";
    if (rest < 10) return [result, units[rest]].filter(Boolean).join(" ");
    if (rest < 20) return [result, teens[rest - 10]].filter(Boolean).join(" ");
    if (rest < 30)
      return [
        result,
        rest === 20
          ? "VEINTE"
          : `VEINTI${units[rest - 20].toLowerCase()}`.toUpperCase(),
      ]
        .filter(Boolean)
        .join(" ");
    const ten = tens[Math.floor(rest / 10)];
    return [result, rest % 10 ? `${ten} Y ${units[rest % 10]}` : ten]
      .filter(Boolean)
      .join(" ");
  };
  const amount = Math.max(0, Math.round(value));
  if (amount === 0) return "CERO PESOS COLOMBIANOS M/L";
  const groups = ["", "MIL", "MILLÓN", "MIL MILLONES", "BILLÓN"];
  let remaining = amount;
  let index = 0;
  const parts: string[] = [];
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group) {
      let words = underThousand(group);
      if (index === 1) words = group === 1 ? "MIL" : `${words} MIL`;
      else if (index === 2)
        words =
          group === 1 ? "UN MILLÓN" : `${words.replace(/UNO$/, "UN")} MILLONES`;
      else if (index > 2)
        words =
          group === 1
            ? `UN ${groups[index]}`
            : `${words.replace(/UNO$/, "UN")} ${groups[index]}`;
      parts.unshift(words);
    }
    remaining = Math.floor(remaining / 1000);
    index += 1;
  }
  return `${parts.join(" ")} PESOS COLOMBIANOS M/L`;
}

function proposalNoteLines(notes: string | undefined): string[] {
  return (notes ?? "")
    .split(/\r?\n/)
    .map((note) => note.trim())
    .filter(Boolean);
}

function uid(): string {
  return crypto.randomUUID();
}

/** Ayuda contextual: visible con cursor, foco de teclado o toque. */
const statusHelp: Record<QuoteStatus, string> = {
  received:
    "Radica la solicitud, el contacto y los documentos o planos recibidos.",
  in_review:
    "Valida alcance, requisitos, documentación y si se necesita visita técnica.",
  estimating: "Elabora o ajusta el APU y prepara la propuesta económica.",
  sent: "La propuesta ya fue enviada al cliente; verifica vigencia y seguimiento.",
  awaiting_response:
    "Esperando decisión del cliente. Haz seguimiento si supera 3 días.",
  revision_requested:
    "El cliente pidió cambios: ajusta APU, alcance o propuesta antes de reenviar.",
  confirmed:
    "Oferta aceptada. Convierte la cotización en Obra para iniciar la ejecución.",
  in_execution:
    "La obra está activa: registra avances, costos y consumo de recursos.",
  work_completed:
    "Trabajo terminado: valida entrega, acta y soportes para facturación.",
  billing_pending:
    "Pendiente de facturación o cobro según las condiciones acordadas.",
  closed:
    "Ciclo comercial y de cobro finalizado. Se conserva para consulta y trazabilidad.",
  lost: "No adjudicada. Registra el motivo para análisis comercial futuro.",
};

function QuoteStatusHelp({
  compact = false,
  status,
}: {
  compact?: boolean;
  status?: QuoteStatus;
}) {
  return (
    <span className={`quote-help ${compact ? "is-compact" : ""}`}>
      <button
        type="button"
        className="quote-help-trigger"
        aria-label="Ayuda sobre los estados de cotización"
      >
        ?
      </button>
      <span className="quote-help-popover" role="tooltip">
        <strong>
          {status
            ? `${getStatusMeta(status).label}: qué hacer`
            : "Flujo de cotización"}
        </strong>
        {status ? (
          <span>{statusHelp[status]}</span>
        ) : (
          <>
            <span>
              <b>1. Recibido / En revisión:</b> registra solicitud, planos,
              alcance y visita.
            </span>
            <span>
              <b>2. Cotización en proceso:</b> crea o modifica el APU y la
              propuesta.
            </span>
            <span>
              <b>3. Enviada / Esperando respuesta:</b> seguimiento comercial al
              cliente.
            </span>
            <span>
              <b>4. Confirmada:</b> conviértela en Obra; luego continúa
              Ejecución, Terminada y Pago.
            </span>
            <span>
              <b>Por modificar:</b> habilita ajustar el APU tras comentarios del
              cliente.
            </span>
          </>
        )}
      </span>
    </span>
  );
}

/* ── Componente principal ────────────────────────────────────── */

type ViewMode = "kanban" | "list";

export function QuotesWorkspace({ initialQuotes }: { initialQuotes: Quote[] }) {
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  /*
      return initialQuotes.map((quote) => {
        const linkedApus = apus.filter((apu) => apu.quoteId === quote.id);
        if (!linkedApus.length) return quote;
        const directCosts = apuCostBreakdown(linkedApus);
        const sellingBreakdown = apuSellingBreakdown(linkedApus);
        const directTotal =
          directCosts.materials +
          directCosts.labor +
          directCosts.equipment +
          directCosts.transport;
        const sellingTotal =
          sellingBreakdown.materials +
          sellingBreakdown.labor +
          sellingBreakdown.equipment +
          sellingBreakdown.transport;
        const profit = Math.max(0, sellingTotal - directTotal);
        const costBreakdown = {
          ...quote.costBreakdown,
          ...directCosts,
          indirects: profit,
        };
        const estimatedValue =
          sellingTotal > 0 ? sellingTotal : calculateTotalCost(costBreakdown);
        return { ...quote, costBreakdown, estimatedValue };
      });
    } catch {
      return initialQuotes;
  */

  const [view, setView] = useState<ViewMode>("kanban");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(() => {
    const quoteId = searchParams.get("quoteId");
    return quoteId
      ? (quotes.find((quote) => quote.id === quoteId) ?? null)
      : null;
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [quoteToPrint, setQuoteToPrint] = useState<Quote | null>(null);
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [isRemoteReady, setIsRemoteReady] = useState(false);

  // Auto-desvanecer aviso de acción
  useEffect(() => {
    if (!actionNotice) return;
    const t = setTimeout(() => setActionNotice(null), 4500);
    return () => clearTimeout(t);
  }, [actionNotice]);


  useEffect(() => {
    let active = true;
    void loadQuotesWorkspaceData()
      .then((remote) => {
        if (!active || !remote) return;
        setCompanyId(remote.companyId);
        setBranchId(remote.branchId ?? null);
        const remoteQuotes = remote.quotes;
        setQuotes((current) => {
          if (remoteQuotes.length) return remoteQuotes;
          // Primera sincronización: conservar únicamente registros locales reales y
          // reemplazar sus IDs históricos cortos por UUIDs válidos para Supabase.
          return current.map((quote) => ({
            ...quote,
            id: crypto.randomUUID(),
            history: quote.history.map((entry) => ({ ...entry, id: crypto.randomUUID() })),
          }));
        });
        setSelectedQuote((current) => current && remoteQuotes.length ? remoteQuotes.find((quote) => quote.id === current.id) ?? null : current);
        setIsRemoteReady(true);
      })
      .catch((error) => {
        if (active) setActionNotice(error instanceof Error ? error.message : "No fue posible cargar las cotizaciones compartidas.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!companyId || !isRemoteReady) return;
    void Promise.all(quotes.map((quote) => saveQuote(companyId, quote))).catch((error) => {
      setActionNotice(error instanceof Error ? `No se guardaron los cambios: ${error.message}` : "No se guardaron los cambios en la base de datos.");
    });
  }, [companyId, isRemoteReady, quotes]);

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
    if (filterStatus !== "all")
      result = result.filter((q) => q.status === filterStatus);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (q) =>
          q.title.toLowerCase().includes(term) ||
          q.code.toLowerCase().includes(term) ||
          q.client.toLowerCase().includes(term) ||
          (q.responsible && q.responsible.toLowerCase().includes(term)),
      );
    }
    return result;
  }, [quotes, filterStatus, searchTerm]);

  /* ── Cambiar estado con nota ─────────────────────────────── */
  const changeStatus = useCallback(
    (quoteId: string, newStatus: QuoteStatus, note?: string) => {
      const now = new Date().toISOString();
      setQuotes((prev) =>
        prev.map((q) => {
          if (q.id !== quoteId) return q;
          const entry: QuoteHistoryEntry = {
            id: uid(),
            fromStatus: q.status,
            toStatus: newStatus,
            changedBy: "Jorge Figueroa",
            changedAt: now,
            note,
          };
          const isNowSent = newStatus === "sent" && !q.sentAt;
          return {
            ...q,
            status: newStatus,
            sentAt: isNowSent ? now.slice(0, 10) : q.sentAt,
            updatedAt: now,
            history: [...q.history, entry],
          };
        }),
      );
      setSelectedQuote((prev) => {
        if (!prev || prev.id !== quoteId) return prev;
        const entry: QuoteHistoryEntry = {
          id: uid(),
          fromStatus: prev.status,
          toStatus: newStatus,
          changedBy: "Jorge Figueroa",
          changedAt: now,
          note,
        };
        const isNowSent = newStatus === "sent" && !prev.sentAt;
        return {
          ...prev,
          status: newStatus,
          sentAt: isNowSent ? now.slice(0, 10) : prev.sentAt,
          updatedAt: now,
          history: [...prev.history, entry],
        };
      });
    },
    [],
  );

  /* ── Guardar actualización de Pre-costeo ─────────────────── */
  const handleSaveCostBreakdown = useCallback(
    (quoteId: string, breakdown: QuoteCostBreakdown) => {
      const total = calculateTotalCost(breakdown);
      const now = new Date().toISOString();
      setQuotes((prev) =>
        prev.map((q) => {
          if (q.id !== quoteId) return q;
          return {
            ...q,
            costBreakdown: breakdown,
            estimatedValue: total > 0 ? total : q.estimatedValue,
            updatedAt: now,
          };
        }),
      );
      setSelectedQuote((prev) => {
        if (!prev || prev.id !== quoteId) return prev;
        return {
          ...prev,
          costBreakdown: breakdown,
          estimatedValue: total > 0 ? total : prev.estimatedValue,
          updatedAt: now,
        };
      });
      setActionNotice("Pre-costeo de 3 rubros actualizado con éxito.");
    },
    [],
  );

  const handleSaveProposalNotes = useCallback(
    (quoteId: string, notes: string) => {
      const updatedAt = new Date().toISOString();
      const nextNotes = notes.trim() || undefined;
      setQuotes((previous) =>
        previous.map((quote) =>
          quote.id === quoteId
            ? { ...quote, notes: nextNotes, updatedAt }
            : quote,
        ),
      );
      setSelectedQuote((previous) =>
        previous?.id === quoteId
          ? { ...previous, notes: nextNotes, updatedAt }
          : previous,
      );
      setActionNotice(
        nextNotes
          ? "Notas para la propuesta guardadas."
          : "Notas para la propuesta eliminadas.",
      );
    },
    [],
  );

  const handleSaveGeneralData = useCallback((quoteId: string, changes: Pick<Quote, "title" | "client" | "contactName" | "contactEmail" | "contactPhone" | "responsible" | "deadline" | "nextAction">) => {
    const updatedAt = new Date().toISOString();
    setQuotes((previous) => previous.map((quote) => {
      if (quote.id !== quoteId) return quote;
      const changedFields = Object.entries(changes)
        .filter(([key, value]) => value !== undefined && quote[key as keyof Quote] !== value)
        .map(([key]) => ({ title: "título", client: "cliente", contactName: "contacto", contactEmail: "email", contactPhone: "teléfono", responsible: "responsable", deadline: "fecha límite", nextAction: "próxima acción" }[key] ?? key));
      const entry: QuoteHistoryEntry = {
        id: uid(),
        fromStatus: quote.status,
        toStatus: quote.status,
        changedBy: quote.responsible || "Usuario",
        changedAt: updatedAt,
        note: `Actualización de datos generales: ${changedFields.join(", ") || "sin cambios"}.`,
      };
      return { ...quote, ...changes, updatedAt, history: [...quote.history, entry] };
    }));
    setSelectedQuote((previous) => previous?.id === quoteId ? { ...previous, ...changes, updatedAt, history: [...previous.history, { id: uid(), fromStatus: previous.status, toStatus: previous.status, changedBy: previous.responsible || "Usuario", changedAt: updatedAt, note: `Actualización de datos generales.` }] } : previous);
    setActionNotice("Datos de la cotización actualizados y sincronizados.");
  }, []);

  /* ── Guardar actualización de Visita Técnica ─────────────── */
  const handleSaveTechnicalVisit = useCallback(
    (quoteId: string, visit: TechnicalVisit) => {
      const now = new Date().toISOString();
      setQuotes((prev) =>
        prev.map((q) => {
          if (q.id !== quoteId) return q;
          return { ...q, technicalVisit: visit, updatedAt: now };
        }),
      );
      setSelectedQuote((prev) => {
        if (!prev || prev.id !== quoteId) return prev;
        return { ...prev, technicalVisit: visit, updatedAt: now };
      });
      setActionNotice("Datos de visita técnica guardados.");
    },
    [],
  );

  /* ── Crear nueva revisión (R1, R2...) ───────────────────── */
  const handleCreateRevision = useCallback(
    (quoteId: string, reason: string) => {
      const now = new Date().toISOString();
      setQuotes((prev) =>
        prev.map((q) => {
          if (q.id !== quoteId) return q;
          const nextRev = (q.revision || 0) + 1;
          const entry: QuoteHistoryEntry = {
            id: uid(),
            fromStatus: q.status,
            toStatus: "revision_requested",
            changedBy: "Jorge Figueroa",
            changedAt: now,
            note: `Creación de Revisión R${nextRev}: ${reason}`,
          };
          return {
            ...q,
            revision: nextRev,
            status: "revision_requested",
            updatedAt: now,
            history: [...q.history, entry],
          };
        }),
      );
      setSelectedQuote((prev) => {
        if (!prev || prev.id !== quoteId) return prev;
        const nextRev = (prev.revision || 0) + 1;
        const entry: QuoteHistoryEntry = {
          id: uid(),
          fromStatus: prev.status,
          toStatus: "revision_requested",
          changedBy: "Jorge Figueroa",
          changedAt: now,
          note: `Creación de Revisión R${nextRev}: ${reason}`,
        };
        return {
          ...prev,
          revision: nextRev,
          status: "revision_requested",
          updatedAt: now,
          history: [...prev.history, entry],
        };
      });
      setActionNotice("Nueva revisión generada con éxito.");
    },
    [],
  );

  /* ── Conversión 1-Click a Obra / Proyecto ────────────────── */
  const handleConvertToProject = useCallback(async (quote: Quote) => {
    if (!companyId || !branchId) {
      setActionNotice("No fue posible validar la empresa o sede del usuario. Vuelve a iniciar sesión.");
      return;
    }
    const now = new Date();
    const createdAt = now.toISOString();
    const startDate = createdAt.slice(0, 10);
    const estimatedEnd = new Date(now);
    estimatedEnd.setDate(estimatedEnd.getDate() + (quote.deliveryTimeWeeks ?? 3) * 7);
    const estimatedEndDate = estimatedEnd.toISOString().slice(0, 10);
    if (isConverting) return;
    setIsConverting(true);
    try {
      const result = await convertQuoteToProject(companyId, branchId, quote.id, {
        projectType: "obra",
        projectName: `${getEffectiveQuoteCode(quote)} · ${quote.title}`,
        client: quote.client,
        location: "Por definir",
        materialBudget: quote.estimatedValue ?? 0,
        startDate,
        estimatedEndDate,
        note: `Cotización convertida a Obra oficial.`,
      });
      const updatedQuote: Quote = {
        ...quote,
        projectId: result.projectId,
        projectCode: result.code,
        status: "in_execution",
        updatedAt: createdAt,
        history: [
          ...quote.history,
          {
            id: uid(),
            fromStatus: quote.status,
            toStatus: "in_execution",
            changedBy: quote.responsible || "Usuario",
            changedAt: createdAt,
            note: `Cotización convertida a Obra oficial: ${result.code}`,
          },
        ],
      };
      setQuotes((prev) => prev.map((q) => (q.id === quote.id ? updatedQuote : q)));
      setSelectedQuote((prev) => (prev && prev.id === quote.id ? updatedQuote : prev));
      setActionNotice(`¡Proyecto creado exitosamente con código ${result.code}!`);
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "No fue posible convertir la cotización a obra.");
    } finally {
      setIsConverting(false);
    }
  }, [companyId, branchId, isConverting]);

  /* ── Crear nueva cotización ────────────────────────────── */
  const handleCreateQuote = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const title = String(fd.get("title") ?? "").trim();
      const client = String(fd.get("client") ?? "").trim();
      const contactName = String(fd.get("contactName") ?? "").trim();
      const contactEmail = String(fd.get("contactEmail") ?? "").trim();
      const contactPhone = String(fd.get("contactPhone") ?? "").trim();
      const emailOrigin = String(fd.get("emailOrigin") ?? "").trim();
      const validityDays = Number(fd.get("validityDays") || 30);
      const deliveryTimeWeeks = Number(fd.get("deliveryTimeWeeks") || 3);
      const paymentTerms = String(
        fd.get("paymentTerms") ?? "50% anticipo, 50% contra entrega",
      ).trim();
      const folderUrl = String(fd.get("folderUrl") ?? "").trim();
      const reqVisit = fd.get("reqVisit") === "on";
      const deadline = String(fd.get("deadline") ?? "").trim();
      const notes = String(fd.get("notes") ?? "").trim();
      const laborScale = String(fd.get("laborScale") ?? "rfc_standard") as
        | "rfc_standard"
        | "ocensa";

      // Valores de pre-costeo preliminares
      const matVal =
        Number(String(fd.get("matValue") ?? "").replace(/\D/g, "")) || 0;
      const labVal =
        Number(String(fd.get("labValue") ?? "").replace(/\D/g, "")) || 0;
      const eqVal =
        Number(String(fd.get("eqValue") ?? "").replace(/\D/g, "")) || 0;
      const estSum = matVal + labVal + eqVal;

      if (!title || !client) return;

      const code = getNextQuoteCode(quotes, client, title);
      const now = new Date().toISOString();
      const newQuote: Quote = {
        id: uid(),
        code,
        revision: 0,
        title,
        client,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        emailOrigin: emailOrigin || undefined,
        status: "received",
        responsible: "Jorge Figueroa",
        estimatedValue: estSum > 0 ? estSum : undefined,
        costBreakdown:
          estSum > 0
            ? {
                materials: matVal,
                labor: labVal,
                equipment: eqVal,
              }
            : undefined,
        laborScale,
        validityDays,
        deliveryTimeWeeks,
        paymentTerms,
        technicalVisit: reqVisit
          ? {
              required: true,
              status: "pending",
              findings:
                "Visita de inspección requerida antes de fijar APU final.",
            }
          : undefined,
        folderUrl: folderUrl || undefined,
        receivedAt: now.slice(0, 10),
        deadline: deadline || undefined,
        notes: notes || undefined,
        nextAction: reqVisit
          ? "Programar visita técnica al sitio de la obra"
          : "Revisar alcance y documentación técnica",
        history: [
          {
            id: uid(),
            fromStatus: null,
            toStatus: "received",
            changedBy: "Jorge Figueroa",
            changedAt: now,
            note: emailOrigin
              ? `Recibido vía: ${emailOrigin}`
              : "Registro manual en el sistema",
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      setQuotes((prev) => [newQuote, ...prev]);
      setShowNewForm(false);
      setSelectedQuote(newQuote);
      setActionNotice(`Cotización ${code} registrada exitosamente.`);
    },
    [quotes],
  );

  return (
    <div className="quotes-workspace">
      {/* ── Aviso flotante de acción ────────────────────────────── */}
      {actionNotice && (
        <div className="quote-action-toast">
          <span>✓ {actionNotice}</span>
          <button onClick={() => setActionNotice(null)}>✕</button>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="quotes-header">
        <div className="quotes-header-left">
          <div className="quotes-title-with-help">
            <h1>Cotizaciones & Pipeline Comercial</h1>
            <QuoteStatusHelp />
          </div>
          <p className="quotes-subtitle">
            Flujo comercial continuo: desde la recepción de la solicitud hasta
            la adjudicación y obra en ejecución.
          </p>
        </div>
        <div className="quotes-header-actions">
          <div
            className="quotes-view-toggle"
            role="group"
            aria-label="Modo de vista"
          >
            <button
              className={`quotes-toggle-btn ${view === "kanban" ? "active" : ""}`}
              onClick={() => setView("kanban")}
              title="Vista Tablero Kanban"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="18" rx="1" />
                <rect x="14" y="3" width="7" height="11" rx="1" />
              </svg>
              Kanban
            </button>
            <button
              className={`quotes-toggle-btn ${view === "list" ? "active" : ""}`}
              onClick={() => setView("list")}
              title="Vista Lista detallada"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="3" />
                <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="3" />
                <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="3" />
              </svg>
              Lista
            </button>
          </div>
          <button
            className="quotes-new-btn"
            onClick={() => setShowNewForm(true)}
          >
            + Nueva Solicitud
          </button>
        </div>
      </header>

      {/* ── Resumen / KPI Pipeline ─────────────────────────────── */}
      <div className="quotes-pipeline-kpi">
        <div className="kpi-block">
          <span className="kpi-label">Pipeline Activo Estimado</span>
          <span className="kpi-value">{formatCOP(totalPipeline)}</span>
        </div>
        <div className="kpi-block">
          <span className="kpi-label">Solicitudes Totales</span>
          <span className="kpi-value">{quotes.length}</span>
        </div>
        <div className="kpi-block">
          <span className="kpi-label">En Cotización / Negociación</span>
          <span className="kpi-value">
            {(summary.estimating || 0) +
              (summary.sent || 0) +
              (summary.awaiting_response || 0)}
          </span>
        </div>
        <div className="kpi-block">
          <span className="kpi-label">Confirmadas / En Obra</span>
          <span className="kpi-value">
            {(summary.confirmed || 0) + (summary.in_execution || 0)}
          </span>
        </div>
      </div>

      {/* ── Chips de filtrado rápido ───────────────────────────── */}
      <div className="quotes-summary-bar">
        <button
          className={`quotes-summary-chip ${filterStatus === "all" ? "active" : ""}`}
          onClick={() => setFilterStatus("all")}
          style={{ "--chip-color": "#0ea5e9" } as React.CSSProperties}
        >
          <span className="chip-label">Todos</span>
          <span className="chip-count">{quotes.length}</span>
        </button>
        {quoteStatuses.map((s) => {
          const count = summary[s.value] || 0;
          if (count === 0 && view === "kanban") return null;
          return (
            <button
              key={s.value}
              className={`quotes-summary-chip ${filterStatus === s.value ? "active" : ""}`}
              onClick={() =>
                setFilterStatus(filterStatus === s.value ? "all" : s.value)
              }
              style={{ "--chip-color": s.color } as React.CSSProperties}
            >
              <span className="chip-icon">{s.icon}</span>
              <span className="chip-label">{s.label}</span>
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Buscador en vivo ───────────────────────────────────── */}
      <div className="quotes-search-bar">
        <input
          type="search"
          placeholder="Buscar por obra, código COT, cliente o responsable..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="quotes-search-input"
        />
        {searchTerm && (
          <button
            className="quotes-clear-filter"
            onClick={() => setSearchTerm("")}
          >
            Limpiar búsqueda ({filtered.length})
          </button>
        )}
      </div>

      {/* ── Vistas: Kanban o Lista ─────────────────────────────── */}
      {view === "kanban" ? (
        <KanbanView
          quotes={filtered}
          onSelectQuote={setSelectedQuote}
          onStatusChange={changeStatus}
          onPrintProposal={setQuoteToPrint}
        />
      ) : (
        <ListView
          quotes={filtered}
          onSelectQuote={setSelectedQuote}
          onStatusChange={changeStatus}
          onPrintProposal={setQuoteToPrint}
        />
      )}

      {/* ── Modal de Detalle con Pestañas y Acciones ────────────── */}
      {selectedQuote && (
        <DetailModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onStatusChange={changeStatus}
          onSaveCostBreakdown={handleSaveCostBreakdown}
          onSaveProposalNotes={handleSaveProposalNotes}
          onSaveGeneralData={handleSaveGeneralData}
          onSaveTechnicalVisit={handleSaveTechnicalVisit}
          onCreateRevision={handleCreateRevision}
          onConvertToProject={handleConvertToProject}
          onPrintProposal={(q) => {
            setQuoteToPrint(q);
          }}
        />
      )}

      {/* ── Modal Nueva Solicitud ──────────────────────────────── */}
      {showNewForm && (
        <NewQuoteModal
          existingQuotes={quotes}
          onSubmit={handleCreateQuote}
          onClose={() => setShowNewForm(false)}
        />
      )}

      {/* ── Modal de Propuesta Comercial Imprimible (PDF) ──────── */}
      {quoteToPrint && (
        <FormalProposalModal
          quote={quoteToPrint}
          onClose={() => setQuoteToPrint(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * KANBAN VIEW
 * ═══════════════════════════════════════════════════════════════ */

function KanbanView({
  quotes,
  onSelectQuote,
  onStatusChange,
  onPrintProposal,
}: {
  quotes: Quote[];
  onSelectQuote: (quote: Quote) => void;
  onStatusChange: (id: string, status: QuoteStatus, note?: string) => void;
  onPrintProposal: (quote: Quote) => void;
}) {
  return (
    <div className="kanban-board">
      {kanbanColumns.map((colStatus) => {
        const meta = getStatusMeta(colStatus);
        const colQuotes = quotes.filter((q) => q.status === colStatus);

        return (
          <div className="kanban-column" key={colStatus}>
            <div
              className="kanban-column-header"
              style={{ "--col-color": meta.color } as React.CSSProperties}
            >
              <span className="kanban-col-icon">{meta.icon}</span>
              <span className="kanban-col-label">{meta.label}</span>
              <QuoteStatusHelp compact status={colStatus} />
              <span className="kanban-col-count">{colQuotes.length}</span>
            </div>

            <div className="kanban-column-body">
              {colQuotes.length === 0 ? (
                <div className="kanban-empty">Sin solicitudes</div>
              ) : (
                colQuotes.map((quote) => (
                  <KanbanCard
                    key={quote.id}
                    quote={quote}
                    onSelect={() => onSelectQuote(quote)}
                    onStatusChange={onStatusChange}
                    onPrint={() => onPrintProposal(quote)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tarjeta Kanban Enriquecida ──────────────────────────────── */

function KanbanCard({
  quote,
  onSelect,
  onStatusChange,
  onPrint,
}: {
  quote: Quote;
  onSelect: () => void;
  onStatusChange: (id: string, status: QuoteStatus, note?: string) => void;
  onPrint: () => void;
}) {
  const stale = isStale(quote);
  const effectiveCode = getEffectiveQuoteCode(quote);
  const expiry = ["sent", "awaiting_response"].includes(quote.status)
    ? getOfferExpiry(quote)
    : null;

  return (
    <div
      className={`kanban-card ${stale ? "kanban-card--stale" : ""}`}
      onClick={onSelect}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <div className="kanban-card-top">
        <div className="kanban-code-rev">
          <span className="kanban-card-code" title={effectiveCode}>
            {effectiveCode}
          </span>
          {quote.revision > 0 && (
            <span className="badge-revision">R{quote.revision}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn-table-print"
            title="Imprimir Propuesta / PDF"
            onClick={(e) => {
              e.stopPropagation();
              onPrint();
            }}
          >
            🖨️
          </button>
          {stale && (
            <span
              className="kanban-stale-badge"
              title="Más de 3 días esperando respuesta"
            >
              ⚠️
            </span>
          )}
        </div>
      </div>

      <h4 className="kanban-card-title">{quote.title}</h4>
      <p className="kanban-card-client">🏢 {quote.client}</p>

      {/* ── Etiquetas de estado: Vigencia y Visita ── */}
      <div className="kanban-card-tags">
        {expiry && (
          <span
            className={`quote-tag ${
              expiry.isExpired
                ? "quote-tag--expired"
                : expiry.isExpiringSoon
                  ? "quote-tag--expiring"
                  : "quote-tag--valid"
            }`}
            title={`Vence: ${expiry.expiryDateStr}`}
          >
            {expiry.isExpired
              ? `⚠️ Vencida hace ${Math.abs(expiry.daysLeft)}d`
              : expiry.isExpiringSoon
                ? `⏰ Vence en ${expiry.daysLeft}d`
                : `⏳ Vigente (${expiry.daysLeft}d)`}
          </span>
        )}

        {quote.technicalVisit?.required && (
          <span
            className={`quote-tag ${
              quote.technicalVisit.status === "completed"
                ? "quote-tag--visit-done"
                : "quote-tag--visit-pending"
            }`}
            title={quote.technicalVisit.findings || "Visita técnica requerida"}
          >
            {quote.technicalVisit.status === "completed"
              ? "✓ Visita OK"
              : "🚜 Visita pend."}
          </span>
        )}

        {quote.folderUrl && (
          <a
            href={quote.folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="quote-tag quote-tag--folder"
            onClick={(e) => e.stopPropagation()}
            title="Abrir expediente de planos"
          >
            📂 Planos
          </a>
        )}
      </div>

      {/* ── Mini desglose de 3 rubros si existe ── */}
      {quote.costBreakdown && (
        <div
          className="kanban-mini-breakdown"
          title="Materiales | Cuadrilla | Equipos"
        >
          <span className="mini-bk-item">
            🧱 Mat: {formatCompactCOP(quote.costBreakdown.materials)}
          </span>
          <span className="mini-bk-item">
            👷 MO: {formatCompactCOP(quote.costBreakdown.labor)}
          </span>
          <span className="mini-bk-item">
            🚜 Eq: {formatCompactCOP(quote.costBreakdown.equipment)}
          </span>
        </div>
      )}

      <div className="kanban-card-meta">
        <span className="kanban-card-value">
          {formatCOP(quote.estimatedValue)}
        </span>
        <span className="kanban-card-date">{formatDate(quote.receivedAt)}</span>
      </div>

      {quote.projectCode && (
        <div className="kanban-linked-project">
          <span>
            🏗️ Obra: <strong>{quote.projectCode}</strong>
          </span>
        </div>
      )}

      {quote.nextAction && (
        <div className="kanban-card-action" title={quote.nextAction}>
          → {quote.nextAction}
        </div>
      )}

      {/* Botón rápido para avanzar al siguiente estado operativo */}
      {getNextQuickStatus(quote.status) && (
        <button
          className="kanban-card-advance"
          style={
            {
              "--adv-color": getStatusMeta(getNextQuickStatus(quote.status)!)
                .color,
            } as React.CSSProperties
          }
          onClick={(e) => {
            e.stopPropagation();
            const next = getNextQuickStatus(quote.status)!;
            onStatusChange(
              quote.id,
              next,
              `Avanzado rápidamente a ${getStatusMeta(next).label}`,
            );
          }}
        >
          Pasar a: {getStatusMeta(getNextQuickStatus(quote.status)!).icon}{" "}
          {getStatusMeta(getNextQuickStatus(quote.status)!).label}
        </button>
      )}
    </div>
  );
}

function getNextQuickStatus(current: QuoteStatus): QuoteStatus | null {
  const flow: Record<QuoteStatus, QuoteStatus | null> = {
    received: "in_review",
    in_review: "estimating",
    estimating: "sent",
    sent: "awaiting_response",
    awaiting_response: "confirmed",
    revision_requested: "estimating",
    confirmed: "in_execution",
    in_execution: "work_completed",
    work_completed: "billing_pending",
    billing_pending: "closed",
    closed: null,
    lost: null,
  };
  return flow[current];
}

/* ═══════════════════════════════════════════════════════════════
 * LIST VIEW
 * ═══════════════════════════════════════════════════════════════ */

function ListView({
  quotes,
  onSelectQuote,
  onStatusChange,
  onPrintProposal,
}: {
  quotes: Quote[];
  onSelectQuote: (quote: Quote) => void;
  onStatusChange: (id: string, status: QuoteStatus, note?: string) => void;
  onPrintProposal: (quote: Quote) => void;
}) {
  return (
    <div className="quotes-list-container">
      <table className="quotes-list-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Obra / Solicitud</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Valor Estimado</th>
            <th>Visita</th>
            <th>Vigencia</th>
            <th>Recibido</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {quotes.length === 0 ? (
            <tr>
              <td colSpan={9} className="quotes-empty">
                No hay solicitudes que coincidan con los filtros.
              </td>
            </tr>
          ) : (
            quotes.map((q) => {
              const meta = getStatusMeta(q.status);
              const stale = isStale(q);
              const effectiveCode = getEffectiveQuoteCode(q);
              const expiry = ["sent", "awaiting_response"].includes(q.status)
                ? getOfferExpiry(q)
                : null;

              return (
                <tr
                  key={q.id}
                  onClick={() => onSelectQuote(q)}
                  className={stale ? "row-stale" : ""}
                  style={{ cursor: "pointer" }}
                >
                  <td className="cell-code">
                    <span>{effectiveCode}</span>
                    {q.revision > 0 && (
                      <span className="badge-revision">R{q.revision}</span>
                    )}
                  </td>
                  <td className="cell-title">
                    <strong>{q.title}</strong>
                    {q.projectCode && (
                      <div className="cell-sub-obra">Obra: {q.projectCode}</div>
                    )}
                  </td>
                  <td>{q.client}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={
                        { "--badge-color": meta.color } as React.CSSProperties
                      }
                    >
                      {meta.icon} {meta.label}
                    </span>
                    {stale && <span className="stale-tag">Estancada</span>}
                  </td>
                  <td className="cell-value">{formatCOP(q.estimatedValue)}</td>
                  <td>
                    {q.technicalVisit?.required ? (
                      <span
                        className={
                          q.technicalVisit.status === "completed"
                            ? "tag-visit-ok"
                            : "tag-visit-wait"
                        }
                      >
                        {q.technicalVisit.status === "completed"
                          ? "✓ Realizada"
                          : "⏳ Pendiente"}
                      </span>
                    ) : (
                      <span style={{ color: "var(--subtle)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {expiry ? (
                      <span
                        className={
                          expiry.isExpired
                            ? "tag-exp-bad"
                            : expiry.isExpiringSoon
                              ? "tag-exp-warn"
                              : "tag-exp-ok"
                        }
                      >
                        {expiry.isExpired ? "Vencida" : `${expiry.daysLeft}d`}
                      </span>
                    ) : (
                      <span style={{ color: "var(--subtle)" }}>—</span>
                    )}
                  </td>
                  <td>{formatDate(q.receivedAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="btn-table-print"
                        onClick={() => onPrintProposal(q)}
                        title="Imprimir Propuesta / PDF"
                      >
                        🖨️
                      </button>
                      <select
                        className="status-select"
                        value={q.status}
                        onChange={(e) =>
                          onStatusChange(q.id, e.target.value as QuoteStatus)
                        }
                      >
                        {quoteStatuses.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.icon} {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * DETAIL MODAL CON PESTAÑAS, COSTEO Y ACCIONES
 * ═══════════════════════════════════════════════════════════════ */

type ModalTab = "general" | "breakdown" | "visit" | "history";

function DetailModal({
  quote,
  onClose,
  onStatusChange,
  onSaveCostBreakdown,
  onSaveProposalNotes,
  onSaveGeneralData,
  onSaveTechnicalVisit,
  onCreateRevision,
  onConvertToProject,
  onPrintProposal,
}: {
  quote: Quote;
  onClose: () => void;
  onStatusChange: (id: string, status: QuoteStatus, note?: string) => void;
  onSaveCostBreakdown: (id: string, breakdown: QuoteCostBreakdown) => void;
  onSaveProposalNotes: (id: string, notes: string) => void;
  onSaveGeneralData: (id: string, changes: Pick<Quote, "title" | "client" | "contactName" | "contactEmail" | "contactPhone" | "responsible" | "deadline" | "nextAction">) => void;
  onSaveTechnicalVisit: (id: string, visit: TechnicalVisit) => void;
  onCreateRevision: (id: string, reason: string) => void;
  onConvertToProject: (quote: Quote) => Promise<void>;
  onPrintProposal: (quote: Quote) => void;
}) {
  const [activeTab, setActiveTab] = useState<ModalTab>("general");
  const [statusNote, setStatusNote] = useState("");
  const [showRevPrompt, setShowRevPrompt] = useState(false);
  const [revReason, setRevReason] = useState("");

  // Estado local para edición de Pre-costeo
  const [materials, setMaterials] = useState(
    quote.costBreakdown?.materials ?? 0,
  );
  const [labor, setLabor] = useState(quote.costBreakdown?.labor ?? 0);
  const [equipment, setEquipment] = useState(
    quote.costBreakdown?.equipment ?? 0,
  );
  const [transport, setTransport] = useState(
    quote.costBreakdown?.transport ?? 0,
  );
  const [indirects, setIndirects] = useState(
    quote.costBreakdown?.indirects ?? 0,
  );
  const [proposalNotes, setProposalNotes] = useState(quote.notes ?? "");
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [generalDraft, setGeneralDraft] = useState({
    title: quote.title, client: quote.client, contactName: quote.contactName ?? "", contactEmail: quote.contactEmail ?? "",
    contactPhone: quote.contactPhone ?? "", responsible: quote.responsible, deadline: quote.deadline?.slice(0, 10) ?? "", nextAction: quote.nextAction ?? "",
  });

  // Estado local para edición de Visita Técnica
  const [visitReq, setVisitReq] = useState(
    quote.technicalVisit?.required ?? false,
  );
  const [visitDate, setVisitDate] = useState(
    quote.technicalVisit?.scheduledDate ?? "",
  );
  const [visitResp, setVisitResp] = useState(
    quote.technicalVisit?.responsible ?? quote.responsible,
  );
  const [visitStatus, setVisitStatus] = useState<
    "pending" | "completed" | "not_required"
  >(quote.technicalVisit?.status ?? "pending");
  const [visitFindings, setVisitFindings] = useState(
    quote.technicalVisit?.findings ?? "",
  );

  const meta = getStatusMeta(quote.status);
  const effectiveCode = getEffectiveQuoteCode(quote);
  const currentCostSum = materials + labor + equipment + transport + indirects;
  const canManageApu =
    quote.status === "estimating" || quote.status === "revision_requested";
  const [hasExistingApu] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        JSON.parse(localStorage.getItem("rfc_apus") || "[]") as Apu[]
      ).some((apu) => apu.quoteId === quote.id);
    } catch {
      return false;
    }
  });
  const apuHref = `/apu?quoteId=${encodeURIComponent(quote.id)}&quoteCode=${encodeURIComponent(effectiveCode)}&quoteTitle=${encodeURIComponent(quote.title)}&quoteStatus=${encodeURIComponent(quote.status)}`;

  return (
    <div
      className="quote-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${effectiveCode}`}
    >
      <div
        className="quote-modal quote-modal--detailed"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header con Consecutivo y Botones Superiores ── */}
        <header className="quote-modal-header">
          <div>
            <span className="quote-modal-code">{effectiveCode}</span>
            {quote.revision > 0 && (
              <span className="badge-revision">Revisión R{quote.revision}</span>
            )}
            <span
              className="status-badge"
              style={{ "--badge-color": meta.color } as React.CSSProperties}
            >
              {meta.icon} {meta.label}
            </span>
          </div>
          <button
            className="quote-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <h2 className="quote-modal-title">{quote.title}</h2>

        {/* ── Barra de Acciones Rápidas (Convertir, Revisión, Imprimir) ── */}
        <div className="quote-modal-action-bar">
          <button
            className="action-pill-btn btn-print"
            onClick={() => onPrintProposal(quote)}
            title="Abrir hoja de propuesta formal para imprimir o guardar PDF"
          >
            🖨️ Imprimir Propuesta / PDF
          </button>

          {canManageApu ? (
            <Link
              className="action-pill-btn btn-apu"
              href={apuHref}
              title="Crear y editar las actividades APU de esta cotización"
            >
              Gestionar APU de esta cotización
            </Link>
          ) : hasExistingApu ? (
            <Link
              className="action-pill-btn btn-apu btn-apu-readonly"
              href={apuHref}
              title="Consultar el APU histórico; solo se habilita edición al crear una revisión."
            >
              Consultar APU (solo lectura)
            </Link>
          ) : (
            <span className="quote-apu-guidance">
              No hay APU creado. Solo se puede crear o editar durante Cotización
              en proceso o Por modificar.
            </span>
          )}

          <button
            className="action-pill-btn btn-revision"
            onClick={() => setShowRevPrompt(!showRevPrompt)}
            title="Crear nueva versión revisada (R1, R2...)"
          >
            🔄 Crear Revisión (R{quote.revision + 1})
          </button>

          {/* Botón de conversión a obra disponible si está confirmado o en ejecución */}
          {["confirmed", "in_execution"].includes(quote.status) &&
            !quote.projectCode && (
              <button
                className="action-pill-btn btn-convert"
                onClick={() => onConvertToProject(quote)}
                title="Crea automáticamente el centro de costos en el módulo de Proyectos"
              >
                🏗️ Convertir a Obra / Proyecto 1-Click
              </button>
            )}

          {quote.projectCode && (
            <Link
              href={`/projects?projectId=${encodeURIComponent(quote.projectId ?? "")}`}
              className="action-pill-btn btn-view-project"
            >
              ✓ Ver Obra: {quote.projectCode} →
            </Link>
          )}
        </div>

        {/* Formulario desplegable para nueva revisión */}
        {showRevPrompt && (
          <div className="revision-prompt-box">
            <h4>Crear Revisión R{quote.revision + 1}</h4>
            <p>
              Registra el motivo del ajuste solicitado por el cliente
              (descuento, alcance, cantidades):
            </p>
            <input
              type="text"
              placeholder="Ej: Cliente solicita rebaja del 5% en materiales y plazo de 2 semanas"
              value={revReason}
              onChange={(e) => setRevReason(e.target.value)}
              className="revision-input"
            />
            <div className="revision-actions">
              <button
                className="quotes-new-btn"
                disabled={!revReason.trim()}
                onClick={() => {
                  onCreateRevision(quote.id, revReason.trim());
                  setShowRevPrompt(false);
                  setRevReason("");
                }}
              >
                Generar R{quote.revision + 1}
              </button>
              <button
                className="quotes-cancel-btn"
                onClick={() => setShowRevPrompt(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Navegación de Pestañas Internas ── */}
        <div className="quote-modal-tabs">
          <button
            className={`quote-tab-btn ${activeTab === "general" ? "active" : ""}`}
            onClick={() => setActiveTab("general")}
          >
            📌 Datos Generales
          </button>
          <button
            className={`quote-tab-btn ${activeTab === "breakdown" ? "active" : ""}`}
            onClick={() => setActiveTab("breakdown")}
          >
            💰 Pre-costeo (3 Rubros)
          </button>
          <button
            className={`quote-tab-btn ${activeTab === "visit" ? "active" : ""}`}
            onClick={() => setActiveTab("visit")}
          >
            🚜 Visita Técnica de Campo
          </button>
          <button
            className={`quote-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            📜 Historial & Estados
          </button>
        </div>

        {/* ── TAB 1: DATOS GENERALES ── */}
        {activeTab === "general" && (
          <div className="quote-tab-content">
            <div className="quote-modal-action-bar">
              <button className="action-pill-btn btn-apu" type="button" onClick={() => setIsEditingGeneral((current) => !current)}>
                {isEditingGeneral ? "Cancelar edición" : "Editar datos de cotización"}
              </button>
            </div>
            {isEditingGeneral ? (
              <form className="quote-modal-grid" onSubmit={(event) => { event.preventDefault(); onSaveGeneralData(quote.id, { ...generalDraft, contactName: generalDraft.contactName || undefined, contactEmail: generalDraft.contactEmail || undefined, contactPhone: generalDraft.contactPhone || undefined, deadline: generalDraft.deadline || undefined, nextAction: generalDraft.nextAction || undefined }); setIsEditingGeneral(false); }}>
                <label className="form-field">Nombre de la actividad / obra<input value={generalDraft.title} onChange={(event) => setGeneralDraft({ ...generalDraft, title: event.target.value })} required /></label>
                <label className="form-field">Cliente<input value={generalDraft.client} onChange={(event) => setGeneralDraft({ ...generalDraft, client: event.target.value })} required /></label>
                <label className="form-field">Contacto<input value={generalDraft.contactName} onChange={(event) => setGeneralDraft({ ...generalDraft, contactName: event.target.value })} /></label>
                <label className="form-field">Correo del contacto<input type="email" value={generalDraft.contactEmail} onChange={(event) => setGeneralDraft({ ...generalDraft, contactEmail: event.target.value })} /></label>
                <label className="form-field">Teléfono<input value={generalDraft.contactPhone} onChange={(event) => setGeneralDraft({ ...generalDraft, contactPhone: event.target.value })} /></label>
                <label className="form-field">Responsable RFC<input value={generalDraft.responsible} onChange={(event) => setGeneralDraft({ ...generalDraft, responsible: event.target.value })} required /></label>
                <label className="form-field">Fecha límite<input type="date" value={generalDraft.deadline} onChange={(event) => setGeneralDraft({ ...generalDraft, deadline: event.target.value })} /></label>
                <label className="form-field">Próxima acción<input value={generalDraft.nextAction} onChange={(event) => setGeneralDraft({ ...generalDraft, nextAction: event.target.value })} /></label>
                <button className="quotes-new-btn" type="submit">Guardar cambios</button>
              </form>
            ) : null}
            <div className="quote-modal-grid">
              <Field label="Cliente" value={quote.client} />
              <Field label="Contacto" value={quote.contactName} />
              <Field label="Correo Contacto" value={quote.contactEmail} />
              <Field label="Teléfono" value={quote.contactPhone} />
              <Field label="Responsable RFC" value={quote.responsible} />
              <Field
                label="Valor Estimado"
                value={formatCOP(quote.estimatedValue)}
              />
              <Field label="Recibido el" value={formatDate(quote.receivedAt)} />
              <Field
                label="Fecha Límite Entrega"
                value={formatDate(quote.deadline)}
              />
              <Field
                label="Validez Comercial"
                value={`${quote.validityDays ?? 30} días`}
              />
              <Field
                label="Tiempo de Entrega"
                value={`${quote.deliveryTimeWeeks ?? 3} semanas`}
              />
              <Field label="Condiciones de Pago" value={quote.paymentTerms} />
              {quote.folderUrl && (
                <div className="quote-field">
                  <span className="quote-field-label">
                    Expediente en la nube
                  </span>
                  <a
                    href={quote.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-folder"
                  >
                    📂 Abrir carpeta de planos y pliegos ↗
                  </a>
                </div>
              )}
            </div>

            {quote.emailOrigin && (
              <div className="quote-info-banner">
                <strong>📧 Correo de Solicitud Original:</strong>{" "}
                {quote.emailOrigin}
              </div>
            )}

            {quote.nextAction && (
              <div className="quote-modal-next-action">
                <strong>→ Próxima acción requerida:</strong> {quote.nextAction}
              </div>
            )}

            <div className="quote-proposal-notes-editor">
              <label htmlFor="quote-proposal-notes">
                <strong>Notas para la propuesta</strong>
                <small>
                  Escribe una nota por renglón; cada una se imprimirá en su
                  propia fila debajo del valor en letras.
                </small>
              </label>
              <textarea
                id="quote-proposal-notes"
                rows={4}
                value={proposalNotes}
                onChange={(event) => setProposalNotes(event.target.value)}
                placeholder={
                  "Ej. valor incluye transporte\nEj. no incluye IVA\nEj. vigencia según oferta"
                }
              />
              <button
                type="button"
                className="quotes-new-btn"
                onClick={() => onSaveProposalNotes(quote.id, proposalNotes)}
              >
                Guardar notas
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: PRE-COSTEO POR 3 RUBROS ── */}
        {activeTab === "breakdown" && (
          <div className="quote-tab-content">
            <p className="tab-intro">
              Estructura paramétrica de costos preliminares. Al aprobarse la
              cotización, estos valores se trasladarán al presupuesto base de la
              obra.
            </p>

            <div className="cost-breakdown-editor">
              <div className="cost-row">
                <label>
                  <span>🧱 1. Materiales e Insumos</span>
                  <small>Acero, tubería, cemento, agregados, soldadura</small>
                </label>
                <div className="input-currency">
                  <span>$</span>
                  <input
                    type="number"
                    value={materials || ""}
                    onChange={(e) => setMaterials(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="cost-row">
                <label>
                  <span>👷 2. Mano de Obra y Cuadrillas</span>
                  <small>Oficiales, soldadores 6G, armadores, ayudantes</small>
                </label>
                <div className="input-currency">
                  <span>$</span>
                  <input
                    type="number"
                    value={labor || ""}
                    onChange={(e) => setLabor(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="cost-row">
                <label>
                  <span>🚜 3. Equipos, Maquinaria y Herramientas</span>
                  <small>Grúas, retroexcavadora, compresor, andamios</small>
                </label>
                <div className="input-currency">
                  <span>$</span>
                  <input
                    type="number"
                    value={equipment || ""}
                    onChange={(e) => setEquipment(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="cost-row">
                <label>
                  <span>🚛 4. Transporte y Fletes</span>
                  <small>Logística Caucasia - frente de obra</small>
                </label>
                <div className="input-currency">
                  <span>$</span>
                  <input
                    type="number"
                    value={transport || ""}
                    onChange={(e) => setTransport(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="cost-row">
                <label>
                  <span>📋 5. Imprevistos / AIU</span>
                  <small>Administración, imprevistos y utilidad</small>
                </label>
                <div className="input-currency">
                  <span>$</span>
                  <input
                    type="number"
                    value={indirects || ""}
                    onChange={(e) => setIndirects(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="cost-total-row">
                <span>Total Estimado Cotización (COP):</span>
                <strong>{formatCOP(currentCostSum)}</strong>
              </div>

              <div style={{ textAlign: "right", marginTop: "16px" }}>
                <button
                  className="quotes-new-btn"
                  onClick={() => {
                    onSaveCostBreakdown(quote.id, {
                      materials,
                      labor,
                      equipment,
                      transport,
                      indirects,
                    });
                  }}
                >
                  Guardar Pre-costeo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: VISITA TÉCNICA DE CAMPO ── */}
        {activeTab === "visit" && (
          <div className="quote-tab-content">
            <p className="tab-intro">
              Control de inspección previa en sitio para levantamiento de
              medidas, estado de accesos fluviales/terrestres y condiciones de
              seguridad.
            </p>

            <div className="visit-editor">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={visitReq}
                  onChange={(e) => setVisitReq(e.target.checked)}
                />
                <span>Requiere visita técnica de inspección en campo</span>
              </label>

              {visitReq && (
                <>
                  <div className="new-quote-row" style={{ marginTop: "14px" }}>
                    <label className="form-field">
                      Fecha programada
                      <input
                        type="date"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      Ingeniero / Inspector responsable
                      <input
                        type="text"
                        value={visitResp}
                        onChange={(e) => setVisitResp(e.target.value)}
                        placeholder="Ej: Ing. Jorge Figueroa"
                      />
                    </label>
                  </div>

                  <label className="form-field" style={{ marginTop: "14px" }}>
                    Estado de la visita
                    <select
                      value={visitStatus}
                      onChange={(e) =>
                        setVisitStatus(
                          e.target.value as NonNullable<
                            TechnicalVisit["status"]
                          >,
                        )
                      }
                      className="status-select"
                      style={{ padding: "10px" }}
                    >
                      <option value="pending">
                        ⏳ Visita pendiente de realización
                      </option>
                      <option value="completed">
                        ✓ Visita técnica ejecutada a satisfacción
                      </option>
                      <option value="not_required">
                        ✕ No requerida / Cancelada
                      </option>
                    </select>
                  </label>

                  <label className="form-field" style={{ marginTop: "14px" }}>
                    Hallazgos, mediciones y observaciones de campo
                    <textarea
                      rows={4}
                      value={visitFindings}
                      onChange={(e) => setVisitFindings(e.target.value)}
                      placeholder="Indicar estado del terreno, accesos, requerimientos de andamiaje, redes eléctricas..."
                    />
                  </label>
                </>
              )}

              <div style={{ textAlign: "right", marginTop: "16px" }}>
                <button
                  className="quotes-new-btn"
                  onClick={() => {
                    onSaveTechnicalVisit(quote.id, {
                      required: visitReq,
                      scheduledDate: visitDate || undefined,
                      responsible: visitResp || undefined,
                      status: visitStatus,
                      findings: visitFindings || undefined,
                    });
                  }}
                >
                  Guardar Datos de Visita
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: HISTORIAL & CAMBIO DE ESTADO ── */}
        {activeTab === "history" && (
          <div className="quote-tab-content">
            {/* Cambiar estado */}
            <div className="quote-modal-status-change">
              <label className="quote-modal-label">
                Actualizar estado del pipeline <QuoteStatusHelp compact />
              </label>
              <div className="quote-modal-status-row">
                <select
                  className="status-select"
                  defaultValue={quote.status}
                  id="modal-status-select-tab"
                >
                  {quoteStatuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.icon} {s.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="quote-modal-note-input"
                  placeholder="Nota explicativa del cambio (obligatoria para trazabilidad)..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
                <button
                  className="quotes-new-btn"
                  onClick={() => {
                    const sel = (
                      document.getElementById(
                        "modal-status-select-tab",
                      ) as HTMLSelectElement
                    ).value as QuoteStatus;
                    if (sel !== quote.status) {
                      onStatusChange(quote.id, sel, statusNote || undefined);
                      setStatusNote("");
                    }
                  }}
                >
                  Actualizar Estado
                </button>
              </div>
            </div>

            {/* Línea de tiempo cronológica */}
            <div className="quote-modal-history">
              <h3>Historial cronológico de cambios</h3>
              <div className="quote-history-timeline">
                {[...quote.history].reverse().map((entry) => {
                  const toMeta = getStatusMeta(entry.toStatus);
                  const fromMeta = entry.fromStatus
                    ? getStatusMeta(entry.fromStatus)
                    : null;
                  return (
                    <div className="history-entry" key={entry.id}>
                      <div
                        className="history-dot"
                        style={{ background: toMeta.color }}
                      />
                      <div className="history-content">
                        <div className="history-meta">
                          <strong>{entry.changedBy}</strong>
                          <span className="history-date">
                            {formatDateTime(entry.changedAt)}
                          </span>
                        </div>
                        <p className="history-change">
                          {fromMeta ? (
                            <>
                              {fromMeta.icon} {fromMeta.label} → {toMeta.icon}{" "}
                              {toMeta.label}
                            </>
                          ) : (
                            <>
                              {toMeta.icon} {toMeta.label}
                            </>
                          )}
                        </p>
                        {entry.note && (
                          <p className="history-note">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="quote-field">
      <span className="quote-field-label">{label}:</span>
      <span className="quote-field-value"> {value || "—"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * NEW QUOTE MODAL (CON PRE-COSTEO Y VISTA PREVIA DE CONSECUTIVO)
 * ═══════════════════════════════════════════════════════════════ */

function NewQuoteModal({
  existingQuotes,
  onSubmit,
  onClose,
}: {
  existingQuotes: Quote[];
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [reqVisit, setReqVisit] = useState(false);

  // Vista previa en vivo del código que se generará
  const previewCode = useMemo(() => {
    return getNextQuoteCode(
      existingQuotes,
      client || "CLIENTE",
      title || "OBRA",
    );
  }, [existingQuotes, client, title]);

  return (
    <div className="quote-modal-backdrop" onClick={onClose}>
      <div
        className="quote-modal quote-modal--new"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="quote-modal-header">
          <div>
            <h2>Nueva Solicitud de Cotización</h2>
            <div className="live-preview-code">
              Consecutivo generado: <strong>{previewCode}</strong>
            </div>
          </div>
          <button
            className="quote-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <form onSubmit={onSubmit} className="new-quote-form">
          <label className="form-field">
            Título / Obra a cotizar *
            <input
              name="title"
              type="text"
              required
              placeholder="Ej: Reparación chimenea CCM Caucasia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="new-quote-row">
            <label className="form-field">
              Empresa / Cliente *
              <input
                name="client"
                type="text"
                required
                placeholder="Ej: OCENSA, Mineros S.A., Drummond"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </label>
            <label className="form-field">
              Correo o asunto de origen
              <input
                name="emailOrigin"
                type="text"
                placeholder="Ej: agomez@ocensa.com – Solicitud de cotización"
              />
            </label>
          </div>

          <div className="new-quote-row">
            <label className="form-field">
              Nombre de contacto
              <input
                name="contactName"
                type="text"
                placeholder="Ej: Ing. Andrés Gómez"
              />
            </label>
            <label className="form-field">
              Correo electrónico
              <input
                name="contactEmail"
                type="email"
                placeholder="agomez@empresa.com"
              />
            </label>
          </div>

          <div className="new-quote-row">
            <label className="form-field">
              Teléfono de contacto
              <input
                name="contactPhone"
                type="tel"
                placeholder="+57 310 123 4567"
              />
            </label>
            <label className="form-field">
              Fecha límite para cotizar
              <input name="deadline" type="date" />
            </label>
          </div>

          {/* Pre-costeo preliminar */}
          <div className="new-quote-subgroup">
            <span className="subgroup-title">
              💰 Pre-costeo estimado inicial (Opcional)
            </span>
            <div className="new-quote-row">
              <label className="form-field">
                🧱 Materiales (COP)
                <input
                  name="matValue"
                  type="text"
                  placeholder="Ej: 8.500.000"
                />
              </label>
              <label className="form-field">
                👷 Mano de obra (COP)
                <input
                  name="labValue"
                  type="text"
                  placeholder="Ej: 5.200.000"
                />
              </label>
            </div>
            <div className="new-quote-row">
              <label className="form-field">
                🚜 Equipos / Maquinaria (COP)
                <input name="eqValue" type="text" placeholder="Ej: 2.100.000" />
              </label>
              <label className="form-field">
                ⏳ Validez oferta (días)
                <input
                  name="validityDays"
                  type="number"
                  defaultValue={30}
                  min={5}
                />
              </label>
            </div>
          </div>

          <div className="new-quote-row">
            <label className="form-field">
              Tiempo estimado de entrega (semanas)
              <input
                name="deliveryTimeWeeks"
                type="number"
                defaultValue={3}
                min={1}
              />
            </label>
            <label className="form-field">
              Condiciones de pago
              <input
                name="paymentTerms"
                type="text"
                defaultValue="50% anticipo, 50% contra entrega"
              />
            </label>
          </div>

          <div className="new-quote-row">
            <label className="form-field">
              Escala salarial para mano de obra (APUs)
              <select name="laborScale" defaultValue="rfc_standard">
                <option value="rfc_standard">Estándar RFC (General)</option>
                <option value="ocensa">
                  Tabla Salarial Sectorial (Ej: OCENSA)
                </option>
              </select>
            </label>
          </div>

          <label className="form-field">
            Enlace a carpeta de planos / especificaciones (Drive, OneDrive)
            <input
              name="folderUrl"
              type="url"
              placeholder="https://drive.google.com/..."
            />
          </label>

          <label className="checkbox-field" style={{ margin: "8px 0" }}>
            <input
              name="reqVisit"
              type="checkbox"
              checked={reqVisit}
              onChange={(e) => setReqVisit(e.target.checked)}
            />
            <span>
              Requiere visita técnica de campo previa a elaboración de oferta
            </span>
          </label>

          <label className="form-field">
            Notas para la propuesta (aparecen debajo del valor en letras)
            <textarea
              name="notes"
              rows={3}
              placeholder={
                "Ej. valor incluye transporte\nEj. no incluye IVA\nEj. vigencia según oferta"
              }
            />
          </label>

          <div className="new-quote-actions">
            <button
              type="button"
              className="quotes-cancel-btn"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="quotes-new-btn">
              Crear Solicitud {previewCode}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * MODAL DE PROPUESTA COMERCIAL MEMBRETADA IMPRIMIBLE (PDF)
 * ═══════════════════════════════════════════════════════════════ */

function PremiumProposalSheet({ quote }: { quote: Quote }) {
  const effectiveCode = getEffectiveQuoteCode(quote);
  const subtotal =
    quote.estimatedValue ??
    (quote.costBreakdown ? calculateTotalCost(quote.costBreakdown) : 0);
  const vat = Math.round(subtotal * 0.19);
  const total = subtotal + vat;
  const totalInWords = amountInColombianPesos(total);
  const notes = proposalNoteLines(quote.notes);
  const costRows: Array<[string, number]> = quote.costBreakdown
    ? [
        ["Materiales e insumos", quote.costBreakdown.materials],
        ["Mano de obra y cuadrillas técnicas", quote.costBreakdown.labor],
        ["Equipos, maquinaria y herramientas", quote.costBreakdown.equipment],
        ["Transporte, fletes y logística", quote.costBreakdown.transport ?? 0],
        [
          "Administración, imprevistos y utilidad",
          quote.costBreakdown.indirects ?? 0,
        ],
      ]
    : [[quote.title, subtotal]];
  const rows = costRows.filter(([, value]) => value > 0);

  return (
    <article className="formal-proposal-sheet premium-proposal-sheet">
      <header className="premium-quote-header">
        <Image
          src="/rfc-logo.svg"
          alt="Representaciones Figueroa Castro"
          width={76}
          height={58}
          priority
        />
        <div>
          <h1>REPRESENTACIONES FIGUEROA CASTRO S.A.S.</h1>
          <strong>NIT: 900.708.094-7</strong>
        </div>
      </header>
      <section className="premium-recipient">
        <div>
          <strong>SEÑORES</strong>
          <span>
            {quote.client.toUpperCase()}
            {quote.contactName ? ` / ${quote.contactName.toUpperCase()}` : ""}
          </span>
        </div>
        <div>
          <strong>CONTACTO</strong>
          <span>
            {quote.contactEmail || quote.contactPhone || "Por confirmar"}
          </span>
          <b>{effectiveCode}</b>
        </div>
      </section>
      <h2 className="premium-object">{quote.title.toUpperCase()}</h2>
      <table className="premium-quote-table">
        <thead>
          <tr>
            <th>ÍTEM</th>
            <th>DESCRIPCIÓN</th>
            <th>UNIDAD</th>
            <th>CANTIDAD</th>
            <th>VALOR UNITARIO</th>
            <th>VALOR PARCIAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value], index) => (
            <tr key={label}>
              <td>{index + 1}</td>
              <td>{label}</td>
              <td>GLOBAL</td>
              <td>1</td>
              <td>{formatCOP(value)}</td>
              <td>{formatCOP(value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>SUBTOTAL</td>
            <td>{formatCOP(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={5}>IVA 19%</td>
            <td>{formatCOP(vat)}</td>
          </tr>
          <tr className="premium-grand-total">
            <td colSpan={5}>TOTAL</td>
            <td>{formatCOP(total)}</td>
          </tr>
        </tfoot>
      </table>
      <section className="premium-conditions">
        <p>
          <strong>VALOR A PAGAR:</strong> {totalInWords}.
        </p>
        {notes.map((note, index) => (
          <p key={`${note}-${index}`}>
            <strong>{index === 0 ? "NOTAS:" : ""}</strong> {note}
          </p>
        ))}
        <p>
          <strong>TIEMPO DE ENTREGA:</strong> {quote.deliveryTimeWeeks ?? 3}{" "}
          SEMANAS CALENDARIO
        </p>
        <p>
          <strong>FORMA DE PAGO:</strong>{" "}
          {(
            quote.paymentTerms ||
            "30 días calendario después de radicada la factura"
          ).toUpperCase()}
        </p>
        <p>
          <strong>COTIZACIÓN VÁLIDA POR:</strong> {quote.validityDays ?? 30}{" "}
          DÍAS CALENDARIO
        </p>
      </section>
      <footer className="premium-signature-row">
        <div className="premium-signature">
          <Image
            src="/rfc-signature.png"
            alt="Firma de Jorge Figueroa Castro"
            width={190}
            height={55}
          />
          <strong>Jorge Figueroa Castro</strong>
          <span>Representante Legal</span>
        </div>
        <strong>
          {formatDate(quote.sentAt || quote.updatedAt).toUpperCase()}
        </strong>
      </footer>
    </article>
  );
}

function FormalProposalModal({
  quote,
  onClose,
}: {
  quote: Quote;
  onClose: () => void;
}) {
  const effectiveCode = getEffectiveQuoteCode(quote);
  const total =
    quote.estimatedValue ??
    (quote.costBreakdown ? calculateTotalCost(quote.costBreakdown) : 0);
  const totalInWords = amountInColombianPesos(total);
  const notes = proposalNoteLines(quote.notes);
  const validityDays = quote.validityDays ?? 30;
  const deliveryWeeks = quote.deliveryTimeWeeks ?? 3;
  const paymentTerms =
    quote.paymentTerms ??
    "50% de anticipo y 50% contra acta de entrega final a satisfacción.";

  return (
    <div className="quote-modal-backdrop printable-backdrop" onClick={onClose}>
      <div
        className="printable-proposal-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de control (se oculta al imprimir) */}
        <div className="print-controls no-print">
          <div className="print-controls-left">
            <strong>Vista Previa de Oferta Económica</strong>
            <span>{effectiveCode}</span>
          </div>
          <div className="print-controls-right">
            <button className="quotes-new-btn" onClick={() => window.print()}>
              🖨️ Imprimir / Guardar en PDF
            </button>
            <button className="quotes-cancel-btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        {/* ── Documento Membretado RFC ── */}
        <PremiumProposalSheet quote={quote} />
        <div className="formal-proposal-sheet proposal-legacy">
          <header className="proposal-header">
            <div className="proposal-brand">
              <h1 className="company-name">
                REPRESENTACIONES FIGUEROA CASTRO S.A.S.
              </h1>
              <p className="company-sub">
                Obras Civiles · Montajes Mecánicos · Dragados · Suministros
                Industriales
              </p>
              <p className="company-meta">
                Caucasia, Antioquia · Tel: (+57) 310 445 7821 ·
                contacto@representacionesfigueroa.com
              </p>
            </div>
            <div className="proposal-meta-box">
              <div className="proposal-badge">PROPUESTA TÉCNICO-ECONÓMICA</div>
              <div className="proposal-code">{effectiveCode}</div>
              <div className="proposal-date">
                Fecha: {formatDate(quote.sentAt || quote.updatedAt)}
              </div>
            </div>
          </header>

          <hr className="proposal-divider" />

          {/* Información de destinatario */}
          <div className="proposal-client-info">
            <div className="client-info-col">
              <p>
                <strong>SEÑORES:</strong>
              </p>
              <p className="client-name">{quote.client.toUpperCase()}</p>
              {quote.contactName && (
                <p>
                  <strong>Atención:</strong> {quote.contactName}
                </p>
              )}
              {quote.contactEmail && (
                <p>
                  <strong>Correo:</strong> {quote.contactEmail}
                </p>
              )}
              {quote.contactPhone && (
                <p>
                  <strong>Teléfono:</strong> {quote.contactPhone}
                </p>
              )}
            </div>
            <div className="client-info-col">
              <p>
                <strong>Lugar de ejecución:</strong> Bajo Cauca Antioqueño
              </p>
              <p>
                <strong>Validez de la oferta:</strong> {validityDays} días
                calendario
              </p>
              <p>
                <strong>Tiempo de entrega:</strong> {deliveryWeeks} semanas a
                partir del anticipo
              </p>
              <p>
                <strong>Forma de pago:</strong> {paymentTerms}
              </p>
            </div>
          </div>

          {/* Objeto de la propuesta */}
          <div className="proposal-section">
            <h3 className="section-title">
              1. OBJETO Y ALCANCE DE LOS TRABAJOS
            </h3>
            <p className="proposal-description">
              Representaciones Figueroa Castro S.A.S. se complace en someter a
              su consideración la propuesta técnico-económica para la ejecución
              de: <strong>{quote.title}</strong>, de conformidad con las
              especificaciones técnicas suministradas y las normas de ingeniería
              aplicables.
            </p>
            {notes.length > 0 && (
              <div className="proposal-scope-notes">
                <p>
                  <strong>Notas para la propuesta:</strong>
                </p>
                {notes.map((note, index) => (
                  <p key={`${note}-${index}`}>{note}</p>
                ))}
              </div>
            )}
          </div>

          {/* Resumen económico */}
          <div className="proposal-section">
            <h3 className="section-title">
              2. PRESUPUESTO ECONÓMICO DISCRIMINADO
            </h3>
            <table className="proposal-cost-table">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th>Concepto / Rubro Operativo</th>
                  <th style={{ textAlign: "right" }}>Valor Estimado (COP)</th>
                </tr>
              </thead>
              <tbody>
                {quote.costBreakdown ? (
                  <>
                    <tr>
                      <td>01</td>
                      <td>
                        Suministro de Materiales e Insumos Industriales
                        Certificados
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {formatCOP(quote.costBreakdown.materials)}
                      </td>
                    </tr>
                    <tr>
                      <td>02</td>
                      <td>
                        Mano de Obra Especializada y Cuadrillas Técnicas con ARL
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {formatCOP(quote.costBreakdown.labor)}
                      </td>
                    </tr>
                    <tr>
                      <td>03</td>
                      <td>
                        Equipos, Maquinaria, Herramientas Certificadas y
                        Operación
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {formatCOP(quote.costBreakdown.equipment)}
                      </td>
                    </tr>
                    {Boolean(quote.costBreakdown.transport) && (
                      <tr>
                        <td>04</td>
                        <td>
                          Transporte Fluvial / Terrestre y Logística a Frente de
                          Obra
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCOP(quote.costBreakdown.transport)}
                        </td>
                      </tr>
                    )}
                    {Boolean(quote.costBreakdown.indirects) && (
                      <tr>
                        <td>05</td>
                        <td>
                          Costos de Administración, Imprevistos y Contingencias
                          (AIU)
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCOP(quote.costBreakdown.indirects)}
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td>01</td>
                    <td>
                      Ejecución integral de la obra según alcance especificado
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {formatCOP(quote.estimatedValue)}
                    </td>
                  </tr>
                )}
                <tr className="proposal-total-row">
                  <td colSpan={2} style={{ textAlign: "right" }}>
                    <strong>VALOR TOTAL PROPUESTA (COP):</strong>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <strong>{formatCOP(total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="proposal-value-in-words">
              <strong>VALOR EN LETRAS:</strong> {totalInWords}.
            </p>
          </div>

          {/* Condiciones comerciales */}
          <div className="proposal-section">
            <h3 className="section-title">
              3. CONDICIONES COMERCIALES Y CONTRACTUALES
            </h3>
            <ul className="proposal-conditions-list">
              <li>
                Los precios ofertados no incluyen IVA a menos que se especifique
                lo contrario.
              </li>
              <li>
                La presente oferta económica tiene una validez de {validityDays}{" "}
                días calendario a partir de su emisión.
              </li>
              <li>
                El tiempo de ejecución estimado es de {deliveryWeeks} semanas
                tras la firma del acta de inicio y pago del anticipo
                correspondiente.
              </li>
              <li>
                Representaciones Figueroa Castro S.A.S. garantiza el
                cumplimiento estricto de las normas SG-SST, dotación EPP y
                pólizas de ley.
              </li>
            </ul>
          </div>

          {/* Firmas de aceptación */}
          <div className="proposal-signatures">
            <div className="sig-box">
              <div className="sig-line" />
              <p>
                <strong>Jorge Figueroa Castro</strong>
              </p>
              <p>Representante Legal / Gerencia Técnica</p>
              <p>Representaciones Figueroa Castro S.A.S.</p>
            </div>
            <div className="sig-box">
              <div className="sig-line" />
              <p>
                <strong>Aceptado y Aprobado por el Cliente</strong>
              </p>
              <p>{quote.client}</p>
              <p>Nombre, Cargo y Firma Autorizada</p>
            </div>
          </div>
          <footer className="print-bottom-actions no-print">
            <button
              className="quotes-cancel-btn"
              type="button"
              onClick={onClose}
            >
              Cerrar vista previa
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
