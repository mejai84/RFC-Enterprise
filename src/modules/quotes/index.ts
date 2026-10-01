/* ─────────────────────────────────────────────────────────────
 * Módulo de Cotizaciones – Contrato público
 * src/modules/quotes/index.ts
 * ───────────────────────────────────────────────────────────── */

export type {
  Quote,
  QuoteStatus,
  QuoteHistoryEntry,
  QuoteCostBreakdown,
  TechnicalVisit,
} from "./domain/quote";

export {
  quoteStatuses,
  kanbanColumns,
  getNextQuoteCode,
  getEffectiveQuoteCode,
  getStatusMeta,
  daysSince,
  isStale,
  getOfferExpiry,
  calculateTotalCost,
  slugifyCodePart,
} from "./domain/quote";

export { initialQuotes } from "./fixtures";
