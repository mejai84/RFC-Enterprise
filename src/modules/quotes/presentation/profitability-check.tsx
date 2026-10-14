"use client";

import { calculateQuoteProfitability, type Quote } from "@/modules/quotes";
import styles from "./profitability-check.module.css";

export function ProfitabilityCheck({ quote }: { quote: Pick<Quote, "costBreakdown" | "estimatedValue"> }) {
  const result = calculateQuoteProfitability(quote);
  return <section className={styles.card} data-level={result.level} aria-label="Control de rentabilidad">
    <div><p className={styles.eyebrow}>Antes de enviar</p><h4>Rentabilidad de la propuesta</h4><p>{result.label}</p></div>
    <dl><div><dt>Costo estimado</dt><dd>${result.cost.toLocaleString("es-CO")}</dd></div><div><dt>Venta</dt><dd>${result.sale.toLocaleString("es-CO")}</dd></div><div><dt>Utilidad</dt><dd>${result.profit.toLocaleString("es-CO")}</dd></div><div><dt>Margen</dt><dd>{result.marginPercent == null ? "—" : `${result.marginPercent.toFixed(1)} %`}</dd></div></dl>
  </section>;
}