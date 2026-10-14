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

// Expediente comercial (soportes del cliente). Vive aparte de los documentos
// técnicos: no los reemplaza ni participa en la conversión a obra.
export type {
  CommercialDocumentType,
  CommercialDocumentInput,
  QuoteCommercialDocument,
} from "./domain/commercial-document";
export {
  commercialDocumentTypes,
  commercialDocumentLabels,
  commercialDocumentHints,
  commercialDocumentEmptyHints,
  commercialDocumentMimeTypes,
  commercialDocumentMaxBytes,
  validateCommercialDocumentInput,
  groupCommercialDocuments,
  formatCommercialDocumentSize,
} from "./domain/commercial-document";

export {
  loadQuoteCommercialDocuments,
  registerQuoteCommercialDocument,
  deleteQuoteCommercialDocument,
} from "./data/commercial-document-repository";

// Comparador de revisiones (solo lectura).
export type {
  ActivityChange,
  QuoteRevisionActivity,
  QuoteRevisionFields,
  QuoteRevisionSnapshot,
  RevisionComparison,
  RevisionDiffRow,
} from "./domain/revision-comparison";
export {
  compareQuoteRevisions,
  compareRevisionActivities,
  revisionLabel,
  formatCurrency,
  formatDate,
} from "./domain/revision-comparison";

export {
  loadQuoteRevisionSnapshots,
  loadQuoteRevisionReasons,
} from "./data/revision-snapshot-repository";

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

  quoteStaleness,
  getOfferExpiry,
  calculateTotalCost,
  slugifyCodePart,
} from "./domain/quote";

export { initialQuotes } from "./fixtures";

// Paneles listos para integrar en la ficha de la cotización.
// Son autocontenidos: traen su propio CSS y no tocan quotes-workspace.tsx.
export { CommercialFileSection } from "./presentation/commercial-file-section";
export { RevisionComparator } from "./presentation/revision-comparator";
export { CommercialFollowUpPanel } from "./presentation/commercial-follow-up-panel";
export { ProfitabilityCheck } from "./presentation/profitability-check";

export { loadQuotesWorkspaceData, saveQuote, convertQuoteToProject, currentActorName } from "./data/quote-repository";
export { calculateQuoteProfitability } from "./domain/profitability";
export type { QuoteProfitability } from "./domain/profitability";
export { loadCommercialFollowUps, recordCommercialFollowUp } from "./data/commercial-follow-up-repository";
export type { CommercialFollowUp } from "./data/commercial-follow-up-repository";

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
