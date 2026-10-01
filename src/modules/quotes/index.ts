/* ─────────────────────────────────────────────────────────────
 * Módulo de Cotizaciones – Contrato público
 * src/modules/quotes/index.ts
 * ───────────────────────────────────────────────────────────── */

export type {
  Quote,
  QuoteStatus,
  QuoteHistoryEntry,
} from "./domain/quote";

export {
  quoteStatuses,
  kanbanColumns,
  getNextQuoteCode,
  getStatusMeta,
  daysSince,
  isStale,
} from "./domain/quote";

export { initialQuotes } from "./fixtures";
