/* ─────────────────────────────────────────────────────────────
 * Indicadores comerciales de Cotizaciones – dominio
 * src/modules/reports/domain/quote-indicators.ts
 *
 * Cálculo PURE sobre datos ya leídos. Este módulo no escribe,
 * no llama a Supabase y no conoce la pantalla: recibe filas y
 * devuelve números. Así los indicadores son de solo lectura por
 * construcción, no por convención.
 * ───────────────────────────────────────────────────────────── */

/**
 * Tipos y formato local, a propósito.
 *
 * Informes NO importa el barril de Cotizaciones (`@/modules/quotes`): ese
 * barril también exporta componentes de presentación, y arrastrarlos hasta una
 * vista de solo lectura acopla dos módulos que no necesitan couplarse. Aqui se
 * replican únicamente los datos que el informe necesita leer de `quotes`.
 */
export type QuoteStatus =
  | "received"
  | "in_review"
  | "estimating"
  | "sent"
  | "awaiting_response"
  | "revision_requested"
  | "confirmed"
  | "in_execution"
  | "work_completed"
  | "billing_pending"
  | "closed"
  | "lost";

/** Etiquetas de estado, para leer el informe en el idioma de la operación. */
export const quoteStatusLabels: Record<QuoteStatus, string> = {
  received: "Recibido",
  in_review: "En revisión",
  estimating: "Cotización en proceso",
  sent: "Cotización enviada",
  awaiting_response: "Esperando respuesta",
  revision_requested: "Por modificar",
  confirmed: "Trabajo confirmado",
  in_execution: "En ejecución",
  work_completed: "Trabajo terminado",
  billing_pending: "Pendiente pago",
  closed: "Cerrado",
  lost: "No adjudicado",
};

/** Vigencia vencida de una oferta: se envió, su plazo se agotó y sigue esperando. */
function isOfferExpired(
  quote: { sentAt?: string | null; validityDays?: number | null },
  now: Date,
): boolean {
  if (!quote.sentAt) return false;
  const base = new Date(quote.sentAt).getTime();
  if (Number.isNaN(base)) return false;
  const validityDays = quote.validityDays ?? 30;
  const expiry = base + validityDays * 24 * 60 * 60 * 1000;
  return expiry - now.getTime() <= 0;
}

/** Fila mínima de cotización que necesita el cálculo. */
export type QuoteIndicatorQuote = {
  id: string;
  code: string;
  client: string;
  responsible: string;
  status: QuoteStatus;
  estimatedValue?: number | null;
  receivedAt: string;
  sentAt?: string | null;
  validityDays?: number | null;
  updatedAt: string;
};

export type QuoteIndicatorHistoryEntry = {
  quoteId: string;
  fromStatus: QuoteStatus | null;
  toStatus: QuoteStatus;
  changedAt: string;
  note?: string | null;
};

export type QuoteIndicatorFilters = {
  /** YYYY-MM-DD; filtra por fecha de recepción. */
  from?: string;
  /** YYYY-MM-DD; filtra por fecha de recepción. */
  to?: string;
  responsible?: string;
  client?: string;
};

/** Estados que consideran la cotización ganada. */
const wonStatuses: QuoteStatus[] = [
  "confirmed",
  "in_execution",
  "work_completed",
  "billing_pending",
  "closed",
];

/** Estados que consideran la cotización perdida. */
const lostStatuses: QuoteStatus[] = ["lost"];

/** Estados donde la cotización espera una acción del equipo. */
const waitingStatuses: QuoteStatus[] = ["sent", "awaiting_response", "revision_requested"];

export type StageDuration = {
  status: QuoteStatus;
  label: string;
  /** Duración promedio en días; null si no hay pares entrada/salida. */
  averageDays: number | null;
  samples: number;
};

export type QuoteIndicators = {
  /** Cotizaciones que cumplen los filtros. */
  totalQuotes: number;
  totalValue: number;
  won: { count: number; value: number };
  lost: { count: number; value: number };
  open: { count: number; value: number };
  /** Adjudicación sobre el resultado conocido (ganadas + perdidas). */
  winRate: number | null;
  /** Tasa整体 sobre el total, aunque las pendientes aún no tengan resultado. */
  winRateOfTotal: number | null;
  stages: StageDuration[];
  expired: { count: number; value: number; quotes: QuoteIndicatorQuote[] };
  stagnant: {
    count: number;
    value: number;
    quotes: QuoteIndicatorQuote[];
    thresholdDays: number;
  };
  lossReasons: { reason: string; count: number }[];
  /** Datos que no alcanzan para calcular algo, con su explicación. */
  caveats: string[];
};

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatIndicatorCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatPercent(value: number | null): string {
  if (value == null) return "Sin datos";
  return `${(value * 100).toFixed(1)} %`;
}

function value(quote: QuoteIndicatorQuote): number {
  return Number(quote.estimatedValue ?? 0);
}

/** ¿La cotización cae dentro del período y de los filtros chosen? */
export function matchesQuoteFilters(
  quote: QuoteIndicatorQuote,
  filters: QuoteIndicatorFilters,
): boolean {
  if (filters.responsible && quote.responsible !== filters.responsible) return false;
  if (filters.client && quote.client !== filters.client) return false;
  const received = quote.receivedAt.slice(0, 10);
  if (filters.from && received < filters.from) return false;
  if (filters.to && received > filters.to) return false;
  return true;
}

/**
 * Días que una cotización pasó en cada etapa, a partir del historial.
 *
 * Solo cuenta etapas con entrada y salida reales. Una etapa en la que la
 * cotización sigue aujourd (sin salida) no se promedia: se excluye y se
 * explica en las notas, porque incluirla rebajaría el promedio con un dato
 * que todavía no ha ocurrido.
 */
export function computeStageDurations(
  quotes: QuoteIndicatorQuote[],
  history: QuoteIndicatorHistoryEntry[],
): StageDuration[] {
  const historyByQuote = new Map<string, QuoteIndicatorHistoryEntry[]>();
  for (const entry of history) {
    const list = historyByQuote.get(entry.quoteId) ?? [];
    list.push(entry);
    historyByQuote.set(entry.quoteId, list);
  }
  for (const list of historyByQuote.values()) {
    list.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  }

  const durations = new Map<QuoteStatus, number[]>();

  for (const quote of quotes) {
    const entries = historyByQuote.get(quote.id) ?? [];
    for (let index = 0; index < entries.length; index += 1) {
      const start = entries[index];
      const end = entries[index + 1];
      if (!end) continue;
      const days =
        (new Date(end.changedAt).getTime() - new Date(start.changedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (!Number.isFinite(days) || days < 0) continue;
      const list = durations.get(start.toStatus) ?? [];
      list.push(days);
      durations.set(start.toStatus, list);
    }
  }

  return Array.from(durations.entries())
    .map(([status, days]) => ({
      status,
      label: statusLabel(status),
      averageDays:
        days.reduce((sum, day) => sum + day, 0) / days.length,
      samples: days.length,
    }))
    .sort((a, b) => (b.averageDays ?? 0) - (a.averageDays ?? 0));
}

function statusLabel(status: QuoteStatus): string {
  return quoteStatusLabels[status] ?? status;
}

/** Motivos de pérdida tomados de las notas con las que se cerró «No adjudicado». */
export function computeLossReasons(
  quotes: QuoteIndicatorQuote[],
  history: QuoteIndicatorHistoryEntry[],
): { reason: string; count: number }[] {
  const lostIds = new Set(
    quotes.filter((quote) => lostStatuses.includes(quote.status)).map((quote) => quote.id),
  );
  const counts = new Map<string, number>();

  for (const entry of history) {
    if (!lostIds.has(entry.quoteId)) continue;
    if (entry.toStatus !== "lost") continue;
    const note = (entry.note ?? "").trim();
    if (!note) continue;
    // Se quita el prefijo automático del estado para no contar once veces lo mismo.
    const reason = note
      .replace(/^No adjudicado\s*[:\-–]\s*/i, "")
      .replace(/^Cotizaci[oó]n no adjudicada\s*[:\-–]\s*/i, "")
      .trim();
    if (!reason) continue;
    const key = reason.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/**
 * Calcula todos los indicadores de Cotizaciones.
 *
 * `today` es inyectable para que el resultado sea reproducible en pruebas y
 * no dependa del reloj del navegador.
 */
export function computeQuoteIndicators(
  quotes: QuoteIndicatorQuote[],
  history: QuoteIndicatorHistoryEntry[],
  options: { filters?: QuoteIndicatorFilters; today?: Date; stagnantDays?: number } = {},
): QuoteIndicators {
  const filters = options.filters ?? {};
  const today = options.today ?? new Date();
  const stagnantDays = options.stagnantDays ?? 7;

  const filtered = quotes.filter((quote) => matchesQuoteFilters(quote, filters));
  const filteredIds = new Set(filtered.map((quote) => quote.id));
  const filteredHistory = history.filter((entry) => filteredIds.has(entry.quoteId));

  const wonQuotes = filtered.filter((quote) => wonStatuses.includes(quote.status));
  const lostQuotes = filtered.filter((quote) => lostStatuses.includes(quote.status));
  const openQuotes = filtered.filter(
    (quote) => !wonStatuses.includes(quote.status) && !lostStatuses.includes(quote.status),
  );

  const decided = wonQuotes.length + lostQuotes.length;

  // Vigencia vencida: la oferta se envió, su plazo se agotó y sigue esperando.
  const expiredQuotes = filtered.filter(
    (quote) => waitingStatuses.includes(quote.status) && isOfferExpired(quote, today),
  );

  // Sin seguimiento: abierta y sin movimiento reciente.
  const stagnantQuotes = filtered.filter((quote) => {
    if (wonStatuses.includes(quote.status) || lostStatuses.includes(quote.status)) return false;
    const days = (today.getTime() - new Date(quote.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return days >= stagnantDays;
  });

  const stages = computeStageDurations(filtered, filteredHistory);
  const lossReasons = computeLossReasons(filtered, filteredHistory);

  const caveats: string[] = [];
  if (filtered.length === 0) {
    caveats.push(
      "No hay cotizaciones que cumplan los filtros seleccionados. Amplía el período o quita el filtro de responsable o cliente.",
    );
  }
  if (decided === 0) {
    caveats.push(
      "La tasa de adjudicación se calcula sobre el resultado conocido. Ninguna cotización del período está confirmada ni en «No adjudicado», así que todavía no hay resultado con el cual comparar.",
    );
  }
  if (stages.length === 0) {
    caveats.push(
      "El tiempo promedio por etapa necesita al menos dos movimientos de estado en la misma cotización. Aún no hay historial suficiente.",
    );
  }
  if (lossReasons.length === 0) {
    caveats.push(
      "No hay motivos de pérdida registrados. Se toman de la nota con la que cada cotización pasó a «No adjudicado»; si se cerró sin nota, no hay nada que agrupar.",
    );
  }

  const sum = (list: QuoteIndicatorQuote[]) => list.reduce((total, quote) => total + value(quote), 0);

  return {
    totalQuotes: filtered.length,
    totalValue: sum(filtered),
    won: { count: wonQuotes.length, value: sum(wonQuotes) },
    lost: { count: lostQuotes.length, value: sum(lostQuotes) },
    open: { count: openQuotes.length, value: sum(openQuotes) },
    winRate: decided > 0 ? wonQuotes.length / decided : null,
    winRateOfTotal: filtered.length > 0 ? wonQuotes.length / filtered.length : null,
    stages,
    expired: { count: expiredQuotes.length, value: sum(expiredQuotes), quotes: expiredQuotes },
    stagnant: {
      count: stagnantQuotes.length,
      value: sum(stagnantQuotes),
      quotes: stagnantQuotes,
      thresholdDays: stagnantDays,
    },
    lossReasons,
    caveats,
  };
}

/** Opciones de filtro disponibles a partir de los datos reales leídos. */
export function buildQuoteIndicatorFilterOptions(quotes: QuoteIndicatorQuote[]): {
  responsables: string[];
  clients: string[];
} {
  return {
    responsables: Array.from(new Set(quotes.map((quote) => quote.responsible).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b),
    ),
    clients: Array.from(new Set(quotes.map((quote) => quote.client).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}