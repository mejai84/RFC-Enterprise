/* ─────────────────────────────────────────────────────────────
 * Módulo de Informes – contrato público
 * src/modules/reports/index.ts
 *
 * Informes es de SOLO LECTURA: expone indicadores calculados a
 * partir de datos ya persistidos. No expone escrituras ni
 * dependencias de otros módulos más allá de sus contratos.
 * ───────────────────────────────────────────────────────────── */

export type {
  QuoteIndicatorQuote,
  QuoteIndicatorHistoryEntry,
  QuoteIndicatorFilters,
  QuoteIndicators,
  StageDuration,
  QuoteStatus,
} from "./domain/quote-indicators";

export {
  computeQuoteIndicators,
  computeStageDurations,
  computeLossReasons,
  matchesQuoteFilters,
  buildQuoteIndicatorFilterOptions,
  quoteStatusLabels,
  formatIndicatorCurrency,
  formatPercent,
} from "./domain/quote-indicators";

export {
  loadQuoteIndicatorDataset,
  recordQuoteIndicatorView,
  type QuoteIndicatorDataset,
} from "./data/quote-indicators-repository";

export { QuoteIndicatorsView } from "./presentation/quote-indicators-view";