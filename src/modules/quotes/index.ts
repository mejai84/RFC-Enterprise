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

export { loadQuotesWorkspaceData, saveQuote } from "./data/quote-repository";

export type {
  OcensaActivityType,
  OcensaSpecialty,
  OcensaLaborPosition,
} from "./domain/ocensa-labor";

export {
  ocensaLaborPositions,
  ocensaPropiasScale,
  ocensaNoPropiasScale,
  getOcensaLaborPositions,
  getOcensaPositionsBySpecialty,
  getOcensaPositionsByLevel,
  calculateOcensaLaborCost,
} from "./domain/ocensa-labor";
