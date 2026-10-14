"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildQuoteIndicatorFilterOptions,
  computeQuoteIndicators,
  formatIndicatorCurrency,
  formatPercent,
  type QuoteIndicatorFilters,
} from "../domain/quote-indicators";
import {
  loadQuoteIndicatorDataset,
  recordQuoteIndicatorView,
  type QuoteIndicatorDataset,
} from "../data/quote-indicators-repository";
import styles from "./quote-indicators-view.module.css";

type Props = {
  /** Días sin movimiento que cuentan como «sin seguimiento». */
  stagnantDays?: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthsAgoIso(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 10);
}

/**
 * Indicadores comerciales de Cotizaciones.
 *
 * Solo lectura: el componente no llama ninguna escritura de negocio. Calcula
 * sobre los datos persistidos de `quotes` y `quote_history`, y deja constancia
 * de cada consulta en la auditoría.
 */
export function QuoteIndicatorsView({ stagnantDays = 7 }: Props) {
  const [dataset, setDataset] = useState<QuoteIndicatorDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<QuoteIndicatorFilters>({
    from: monthsAgoIso(6),
    to: todayIso(),
  });

  useEffect(() => {
    let cancelled = false;
    loadQuoteIndicatorDataset()
      .then((result) => {
        if (!cancelled) setDataset(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "No fue posible cargar los indicadores.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const quotes = useMemo(() => dataset?.quotes ?? [], [dataset]);
  const history = useMemo(() => dataset?.history ?? [], [dataset]);
  const options = useMemo(() => buildQuoteIndicatorFilterOptions(quotes), [quotes]);
  const indicators = useMemo(
    () => computeQuoteIndicators(quotes, history, { filters, stagnantDays }),
    [quotes, history, filters, stagnantDays],
  );

  const registerView = useCallback(
    (result: typeof indicators) => {
      const applied: Record<string, string> = {};
      if (filters.from) applied.from = filters.from;
      if (filters.to) applied.to = filters.to;
      if (filters.responsible) applied.responsible = filters.responsible;
      if (filters.client) applied.client = filters.client;
      void recordQuoteIndicatorView(applied, {
        quotesInScope: result.totalQuotes,
        won: result.won.count,
        lost: result.lost.count,
      }).catch(() => undefined);
    },
    [filters.from, filters.to, filters.responsible, filters.client],
  );

  useEffect(() => {
    if (isLoading || !dataset) return;
    registerView(indicators);
  }, [dataset, indicators, isLoading, registerView]);

  const maxStageDays = indicators.stages.reduce(
    (max, stage) => Math.max(max, stage.averageDays ?? 0),
    0,
  );

  return (
    <section className={styles.section} aria-busy={isLoading}>
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Indicadores de Cotizaciones</p>
          <h2 className={styles.title}>Comercial: ganadas, perdidas y seguimiento</h2>
          <p className={styles.subtitle}>
            Lectura de los datos reales de cotizaciones e historial. No permite modificar nada: si
            un número está mal, el ajuste se hace en la ficha de la cotización, no aquí.
          </p>
        </div>
        <span className={styles.readonly}>Solo lectura</span>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {isLoading ? <p className={styles.loading}>Cargando indicadores…</p> : null}

      {!isLoading && dataset && quotes.length === 0 ? (
        <p className={styles.empty}>
          Todavía no hay cotizaciones registradas para tu empresa. Cuando exista la primera
          cotización, aquí aparecerán el valor, la tasa de adjudicación y los tiempos por etapa.
        </p>
      ) : null}

      {!isLoading && dataset && quotes.length > 0 ? (
        <>
          <div className={styles.filters}>
            <label className={styles.field}>
              <span>Desde</span>
              <input
                className={styles.input}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, from: event.target.value || undefined }))
                }
                type="date"
                value={filters.from ?? ""}
              />
            </label>
            <label className={styles.field}>
              <span>Hasta</span>
              <input
                className={styles.input}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, to: event.target.value || undefined }))
                }
                type="date"
                value={filters.to ?? ""}
              />
            </label>
            <label className={styles.field}>
              <span>Responsable</span>
              <select
                className={styles.select}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    responsible: event.target.value || undefined,
                  }))
                }
                value={filters.responsible ?? ""}
              >
                <option value="">Todos</option>
                {options.responsables.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Cliente</span>
              <select
                className={styles.select}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, client: event.target.value || undefined }))
                }
                value={filters.client ?? ""}
              >
                <option value="">Todos</option>
                {options.clients.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={styles.clear}
              onClick={() => setFilters({ from: monthsAgoIso(6), to: todayIso() })}
              type="button"
            >
              Limpiar filtros
            </button>
          </div>

          <div className={styles.cards}>
            <article className={styles.card}>
              <span className={styles.cardLabel}>Cotizaciones en el período</span>
              <span className={styles.cardValue}>{indicators.totalQuotes}</span>
              <span className={styles.cardHint}>
                Valor total {formatIndicatorCurrency(indicators.totalValue)}
              </span>
            </article>
            <article className={`${styles.card} ${styles.cardGood}`}>
              <span className={styles.cardLabel}>Ganadas</span>
              <span className={styles.cardValue}>{indicators.won.count}</span>
              <span className={styles.cardHint}>
                {formatIndicatorCurrency(indicators.won.value)}
              </span>
            </article>
            <article className={`${styles.card} ${styles.cardBad}`}>
              <span className={styles.cardLabel}>Perdidas</span>
              <span className={styles.cardValue}>{indicators.lost.count}</span>
              <span className={styles.cardHint}>
                {formatIndicatorCurrency(indicators.lost.value)}
              </span>
            </article>
            <article className={styles.card}>
              <span className={styles.cardLabel}>Tasa de adjudicación</span>
              <span className={styles.cardValue}>{formatPercent(indicators.winRate)}</span>
              <span className={styles.cardHint}>
                Sobre el resultado conocido · {formatPercent(indicators.winRateOfTotal)} del total
              </span>
            </article>
            <article className={`${styles.card} ${styles.cardWarn}`}>
              <span className={styles.cardLabel}>Vencidas sin respuesta</span>
              <span className={styles.cardValue}>{indicators.expired.count}</span>
              <span className={styles.cardHint}>
                {formatIndicatorCurrency(indicators.expired.value)} · la oferta ya venció
              </span>
            </article>
            <article className={`${styles.card} ${styles.cardWarn}`}>
              <span className={styles.cardLabel}>Sin seguimiento</span>
              <span className={styles.cardValue}>{indicators.stagnant.count}</span>
              <span className={styles.cardHint}>
                Sin movimiento hace {indicators.stagnant.thresholdDays} días o más
              </span>
            </article>
          </div>

          {indicators.caveats.length ? (
            <ul className={styles.caveats}>
              {indicators.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          ) : null}

          <div className={styles.blocks}>
            <section className={styles.block}>
              <h4>Tiempo promedio por etapa</h4>
              <p className={styles.blockHint}>
                Solo cuenta etapas que ya cerraron. La etapa actual de cada cotización abierta se
                excluye porque todavía no ha ocurrido.
              </p>
              {indicators.stages.length ? (
                <div className={styles.table}>
                  {indicators.stages.map((stage) => (
                    <div className={styles.row} key={stage.status}>
                      <span className={styles.rowName}>
                        {stage.label}
                        <span className={styles.cardHint}> · {stage.samples} transiciones</span>
                      </span>
                      <span className={styles.rowValue}>
                        {stage.averageDays == null ? "—" : `${stage.averageDays.toFixed(1)} días`}
                      </span>
                      <span className={styles.bar}>
                        <span
                          className={
                            stage.averageDays != null && maxStageDays > 0 && stage.averageDays === maxStageDays
                              ? styles.barFillAlt
                              : styles.barFill
                          }
                          style={{
                            width: `${
                              maxStageDays > 0 && stage.averageDays != null
                                ? Math.max(4, (stage.averageDays / maxStageDays) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>
                  No hay transiciones de estado suficientes para calcular el tiempo por etapa.
                </p>
              )}
            </section>

            <section className={styles.block}>
              <h4>Motivos de pérdida</h4>
              <p className={styles.blockHint}>
                Se toman de la nota con la que cada cotización pasó a «No adjudicado».
              </p>
              {indicators.lossReasons.length ? (
                <div className={styles.table}>
                  {indicators.lossReasons.map((item) => (
                    <div className={styles.row} key={item.reason}>
                      <span className={styles.rowName}>{item.reason}</span>
                      <span className={styles.rowValue}>{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>
                  No hay motivos de pérdida registrados en el historial de este corte.
                </p>
              )}
            </section>

            <section className={styles.block}>
              <h4>Cotizaciones que requieren atención</h4>
              <p className={styles.blockHint}>
                Vencidas y sin seguimiento, según los filtros aplicados.
              </p>
              {indicators.expired.quotes.length + indicators.stagnant.quotes.length ? (
                <div className={styles.table}>
                  {indicators.expired.quotes.map((quote) => (
                    <div className={styles.row} key={`expired-${quote.id}`}>
                      <span className={styles.rowName}>
                        {quote.code} · {quote.client}
                      </span>
                      <span className={styles.rowValue}>Oferta vencida</span>
                    </div>
                  ))}
                  {indicators.stagnant.quotes.map((quote) => (
                    <div className={styles.row} key={`stagnant-${quote.id}`}>
                      <span className={styles.rowName}>
                        {quote.code} · {quote.client}
                      </span>
                      <span className={styles.rowValue}>Sin seguimiento</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>
                  Ninguna cotización del corte está vencida ni detenida.
                </p>
              )}
            </section>
          </div>

          <p className={styles.footNote}>
            Cada consulta de este informe queda registrada en la auditoría de la empresa con los
            filtros aplicados y el resultado obtenido.
          </p>
        </>
      ) : null}
    </section>
  );
}

export default QuoteIndicatorsView;