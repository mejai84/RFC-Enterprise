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
  TechnicalVisitMeasurement,
  TechnicalVisitPhoto,
  TechnicalVisitChecklistItem,
} from "./domain/quote";

export {
  technicalVisitChecklistTemplates,
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

export { loadQuotesWorkspaceData, saveQuote, convertQuoteToProject } from "./data/quote-repository";

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
