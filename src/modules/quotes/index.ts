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
  TechnicalVisitEntry,
  TechnicalVisitMeasurement,
  TechnicalVisitPhoto,
  TechnicalVisitChecklistItem,
  QuoteVisits,
} from "./domain/quote";

export type { QuoteTechnicalDocument, TechnicalDocumentStatus, TechnicalDocumentType } from "./domain/technical-document";
export { technicalDocumentLabels, technicalDocumentTypes } from "./domain/technical-document";

export {
  technicalVisitChecklistTemplates,
  getQuoteVisits,
  nextVisitSequence,
  appendVisit,
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

export { loadQuotesWorkspaceData, saveQuote, convertQuoteToProject, currentActorName } from "./data/quote-repository";

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
