"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadQuoteRevisionReasons,
  loadQuoteRevisionSnapshots,
} from "../data/revision-snapshot-repository";
import {
  compareQuoteRevisions,
  revisionLabel,
  type QuoteRevisionSnapshot,
} from "../domain/revision-comparison";
import styles from "./revision-comparator.module.css";

type Props = {
  /** Cotización cuyas revisiones se comparan. */
  quoteId: string;
  /** Revisión vigente; se usa como valor inicial de la comparación. */
  currentRevision?: number;
};

const groupLabels: Record<string, string> = {
  valor: "Valor",
  apu: "APU",
  alcance: "Alcance y notas",
  condiciones: "Condiciones comerciales",
  fechas: "Fechas",
};

/**
 * Comparador de revisiones (R1 vs R2).
 *
 * Es estrictamente de SOLO LECTURA: no hay un solo input de edición ni una
 * llamada de escritura. Crear revisiones sigue siendo responsabilidad de la
 * ficha, con su mismo flujo de siempre.
 */
export function RevisionComparator({ quoteId, currentRevision }: Props) {
  const [snapshots, setSnapshots] = useState<QuoteRevisionSnapshot[]>([]);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [leftRevision, setLeftRevision] = useState<number | null>(null);
  const [rightRevision, setRightRevision] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadQuoteRevisionSnapshots(quoteId), loadQuoteRevisionReasons(quoteId)])
      .then(([items, revisionReasons]) => {
        if (cancelled) return;
        setSnapshots(items);
        setReasons(revisionReasons);
        setRightRevision(items[items.length - 1]?.revision ?? null);
        const older = items[items.length - 2];
        setLeftRevision(older?.revision ?? items[0]?.revision ?? null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "No fue posible cargar las revisiones.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  const comparison = useMemo(() => {
    if (snapshots.length === 0) return null;
    const left = snapshots.find((item) => item.revision === leftRevision) ?? null;
    const right = snapshots.find((item) => item.revision === rightRevision) ?? null;
    if (!left || !right) return null;
    return compareQuoteRevisions(left, right);
  }, [snapshots, leftRevision, rightRevision]);

  const currentLabel =
    currentRevision != null && snapshots.some((item) => item.revision === currentRevision)
      ? revisionLabel(currentRevision)
      : null;

  return (
    <section className={styles.section} aria-busy={isLoading}>
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Comparador de revisiones</p>
          <h3 className={styles.title}>Qué cambió entre dos revisiones</h3>
          <p className={styles.subtitle}>
            Vista de solo lectura. Marca en ámbar únicamente los campos que cambiaron; el resto se
            muestra igual en las dos revisiones para poder leer el contexto.
          </p>
        </div>
        <span className={styles.readonly}>Solo lectura</span>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className={styles.loading}>Cargando revisiones…</p> : null}

      {!isLoading && snapshots.length === 0 ? (
        <p className={styles.empty}>
          Todavía no hay instantáneas de esta cotización. Cada vez que se guarde la cotización se
          registra una; en ese momento este comparador podrá mostrar diferencias.
        </p>
      ) : null}

      {!isLoading && snapshots.length > 0 ? (
        <>
          <div className={styles.pickers}>
            <label className={styles.field}>
              <span>Revisión base</span>
              <select
                className={styles.select}
                onChange={(event) => setLeftRevision(Number(event.target.value))}
                value={leftRevision ?? ""}
              >
                {snapshots.map((item) => (
                  <option key={item.revision} value={item.revision}>
                    {revisionLabel(item.revision)}
                    {currentLabel && item.revision === currentRevision ? " (vigente)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Revisión a comparar</span>
              <select
                className={styles.select}
                onChange={(event) => setRightRevision(Number(event.target.value))}
                value={rightRevision ?? ""}
              >
                {snapshots.map((item) => (
                  <option key={item.revision} value={item.revision}>
                    {revisionLabel(item.revision)}
                    {currentLabel && item.revision === currentRevision ? " (vigente)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {leftRevision != null && reasons[leftRevision] ? (
            <p className={styles.reasons}>
              Motivo registrado de {revisionLabel(leftRevision)}: {reasons[leftRevision]}
            </p>
          ) : null}
          {rightRevision != null && reasons[rightRevision] ? (
            <p className={styles.reasons}>
              Motivo registrado de {revisionLabel(rightRevision)}: {reasons[rightRevision]}
            </p>
          ) : null}

          {comparison ? (
            <>
              <div className={styles.summary}>
                <span className={styles.chip}>
                  {comparison.changedCount} campo{comparison.changedCount === 1 ? "" : "s"}{" "}
                  cambiado{comparison.changedCount === 1 ? "" : "s"}
                </span>
                <span className={`${styles.chip} ${styles.chipMuted}`}>
                  {comparison.activityChanges.length} cambio
                  {comparison.activityChanges.length === 1 ? "" : "s"} en actividades APU
                </span>
              </div>

              {comparison.limitation ? (
                <p className={styles.notice}>{comparison.limitation}</p>
              ) : null}

              {["valor", "apu", "alcance", "condiciones", "fechas"].map((group) => {
                const rows = comparison.rows.filter((row) => row.group === group);
                if (!rows.length) return null;
                return (
                  <div className={styles.rows} key={group}>
                    <h4 className={styles.rowLabel}>{groupLabels[group]}</h4>
                    {rows.map((row) => (
                      <article
                        className={row.changed ? `${styles.row} ${styles.rowChanged}` : styles.row}
                        data-changed={row.changed ? "true" : "false"}
                        key={row.key}
                      >
                        <div className={styles.rowHead}>
                          <h5 className={styles.rowLabel}>{row.label}</h5>
                          <span className={row.changed ? styles.flag : `${styles.flag} ${styles.flagSame}`}>
                            {row.changed ? "Cambió" : "Igual"}
                          </span>
                        </div>
                        <div className={styles.values}>
                          <div className={styles.value}>
                            <span className={styles.valueTag}>{comparison.left.label}</span>
                            <p className={styles.valueText}>{row.valueA}</p>
                            {row.detailA ? <p className={styles.valueDetail}>{row.detailA}</p> : null}
                          </div>
                          <div className={styles.value}>
                            <span className={styles.valueTag}>{comparison.right.label}</span>
                            <p className={styles.valueText}>{row.valueB}</p>
                            {row.detailB ? <p className={styles.valueDetail}>{row.detailB}</p> : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                );
              })}

              {comparison.activityChanges.length ? (
                <div className={styles.activities}>
                  <h4>Detalle de actividades APU</h4>
                  <ul className={styles.activityList}>
                    {comparison.activityChanges.map((change) => (
                      <li className={styles.activity} key={`${change.kind}-${change.code}`}>
                        <span>{change.code}</span>
                        <span>{change.name}</span>
                        <span
                          className={
                            change.kind === "added"
                              ? `${styles.kind} ${styles.kindAdded}`
                              : change.kind === "removed"
                                ? `${styles.kind} ${styles.kindRemoved}`
                                : `${styles.kind} ${styles.kindCost}`
                          }
                        >
                          {change.kind === "added" ? "Se agregó" : null}
                          {change.kind === "removed" ? "Se quitó" : null}
                          {change.kind === "cost_changed" ? "Cambió el costo" : null}
                        </span>
                        <span>
                          {comparison.left.label}: {change.valueA}
                        </span>
                        <span>
                          {comparison.right.label}: {change.valueB}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.empty}>Selecciona dos revisiones distintas para comparar.</p>
          )}
        </>
      ) : null}
    </section>
  );
}

export default RevisionComparator;