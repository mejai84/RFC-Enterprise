/* ─────────────────────────────────────────────────────────────
 * Módulo de Cotizaciones – Comparador de revisiones (dominio)
 * src/modules/quotes/domain/revision-comparison.ts
 *
 * Comparación de SOLO LECTURA entre dos revisiones de la misma
 * cotización. Aquí no hay ningún guardado: el módulo recibe dos
 * fotos y devuelve diferencias. Crear revisiones sigue siendo
 * responsabilidad de la ficha, exactamente igual que antes.
 * ───────────────────────────────────────────────────────────── */

import { calculateTotalCost, getStatusMeta, type QuoteCostBreakdown } from "./quote";

/** Foto de los datos comerciales de una revisión. */
export type QuoteRevisionFields = {
  estimatedValue: number | null;
  costBreakdown: QuoteCostBreakdown | null;
  validityDays: number | null;
  deliveryTimeWeeks: number | null;
  paymentTerms: string | null;
  title: string | null;
  notes: string | null;
  status: string | null;
  receivedAt: string | null;
  sentAt: string | null;
  deadline: string | null;
  updatedAt: string | null;
};

/** Una revisión consultable: número, foto y momento de captura. */
export type QuoteRevisionSnapshot = {
  revision: number;
  capturedAt: string;
  /** Actividades de APU vigentes en el momento de la captura. */
  activities: QuoteRevisionActivity[];
  fields: QuoteRevisionFields;
};

/** Actividad APU considerada en una revisión, con su costo total. */
export type QuoteRevisionActivity = {
  code: string;
  name: string;
  unit: string | null;
  versionNumber: number | null;
  totalCost: number | null;
};

/** Una fila del comparador. */
export type RevisionDiffRow = {
  key: string;
  label: string;
  /** Grupo visual, para ordenar la lectura. */
  group: "valor" | "alcance" | "condiciones" | "fechas" | "apu";
  /** Valor de la revisión A, ya formateado para leer. */
  valueA: string;
  /** Valor de la revisión B, ya formateado. */
  valueB: string;
  changed: boolean;
  /** Detalle opcional, por ejemplo el desglose de costeo. */
  detailA?: string;
  detailB?: string;
};

export type RevisionComparison = {
  left: { revision: number; label: string; capturedAt?: string };
  right: { revision: number; label: string; capturedAt?: string };
  rows: RevisionDiffRow[];
  /** Campos que cambiaron, contados una sola vez. */
  changedCount: number;
  /** Actividades agregadas, quitadas o modificadas. */
  activityChanges: ActivityChange[];
  /** Sin datos suficientes para comparar (falta foto de una revisión). */
  limitation?: string;
};

export type ActivityChange = {
  code: string;
  name: string;
  kind: "added" | "removed" | "cost_changed";
  valueA: string;
  valueB: string;
};

/** Etiqueta visible de una revisión. */
export function revisionLabel(revision: number): string {
  return `R${revision}`;
}

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Sin registrar";
  return currencyFormatter.format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Sin registrar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registrar";
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return "Sin registrar";
  const meta = getStatusMeta(status as never);
  return meta ? meta.label : status;
}

function breakdownSummary(breakdown: QuoteCostBreakdown | null | undefined): string {
  if (!breakdown) return "Sin registrar";
  const parts = [
    ["Materiales", breakdown.materials],
    ["Mano de obra", breakdown.labor],
    ["Equipos", breakdown.equipment],
    ["Transporte", breakdown.transport],
    ["Imprevistos", breakdown.indirects],
  ] as const;
  const text = parts
    .filter(([, value]) => typeof value === "number")
    .map(([label, value]) => `${label}: ${formatCurrency(value)}`)
    .join(" · ");
  return text || "Sin rubros registrados";
}

function validitySummary(validityDays: number | null): string {
  if (validityDays == null) return "Sin registrar";
  return `${validityDays} día${validityDays === 1 ? "" : "s"}`;
}

function deliverySummary(weeks: number | null): string {
  if (weeks == null) return "Sin registrar";
  return `${weeks} semana${weeks === 1 ? "" : "s"}`;
}

function textOrEmpty(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  return text || "Sin registrar";
}

/** Compara dos textos ignorando mayúsculas, espacios y saltos de línea sobrantes. */
function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
  return normalize(a) === normalize(b);
}

/** Compara números con tolerancia de un centavo: 0.01 no es un cambio comercial. */
function sameNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  const left = a == null || Number.isNaN(a) ? null : Math.round(a * 100) / 100;
  const right = b == null || Number.isNaN(b) ? null : Math.round(b * 100) / 100;
  return left === right;
}

/** Compara desgloses de costeo rubro por rubro, tolerando el orden de las claves. */
function sameBreakdown(
  a: QuoteCostBreakdown | null | undefined,
  b: QuoteCostBreakdown | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keys = ["materials", "labor", "equipment", "transport", "indirects"] as const;
  return keys.every((key) => sameNumber(a[key] ?? null, b[key] ?? null));
}

/** Diferencias de actividades APU entre dos revisiones. */
export function compareRevisionActivities(
  activitiesA: QuoteRevisionActivity[],
  activitiesB: QuoteRevisionActivity[],
): ActivityChange[] {
  const byCodeA = new Map(activitiesA.map((activity) => [activity.code, activity]));
  const byCodeB = new Map(activitiesB.map((activity) => [activity.code, activity]));
  const codes = Array.from(new Set([...byCodeA.keys(), ...byCodeB.keys()])).sort();

  const changes: ActivityChange[] = [];
  for (const code of codes) {
    const left = byCodeA.get(code);
    const right = byCodeB.get(code);
    if (left && !right) {
      changes.push({ code, name: left.name, kind: "removed", valueA: formatCurrency(left.totalCost), valueB: "No estaba en la otra revisión" });
      continue;
    }
    if (!left && right) {
      changes.push({ code, name: right.name, kind: "added", valueA: "No estaba en la otra revisión", valueB: formatCurrency(right.totalCost) });
      continue;
    }
    if (!left || !right) continue;
    const nameChanged = !sameText(left.name, right.name);
    const costChanged = !sameNumber(left.totalCost ?? null, right.totalCost ?? null);
    if (nameChanged || costChanged) {
      changes.push({
        code,
        name: right.name,
        kind: "cost_changed",
        valueA: formatCurrency(left.totalCost),
        valueB: formatCurrency(right.totalCost),
      });
    }
  }
  return changes;
}

/**
 * Compara dos revisiones y arma las filas del comparador.
 *
 * Si falta la foto de alguna de las dos revisiones, no se inventa nada: se
 * devuelve la limitación y las filas que sí se pueden leer.
 */
export function compareQuoteRevisions(
  snapshotA: QuoteRevisionSnapshot,
  snapshotB: QuoteRevisionSnapshot,
  options: { missing?: "left" | "right" | null } = {},
): RevisionComparison {
  const a = snapshotA.fields;
  const b = snapshotB.fields;

  const rows: RevisionDiffRow[] = [];
  const push = (row: Omit<RevisionDiffRow, "changed"> & { changed: boolean }) => {
    rows.push(row);
  };

  // ── Valor ──────────────────────────────────────────────────────────────
  const estimatedChanged = !sameNumber(a.estimatedValue, b.estimatedValue);
  push({
    key: "estimatedValue",
    label: "Valor total",
    group: "valor",
    valueA: formatCurrency(a.estimatedValue),
    valueB: formatCurrency(b.estimatedValue),
    changed: estimatedChanged,
  });

  const costChanged = !sameBreakdown(a.costBreakdown, b.costBreakdown);
  const costTotal = (breakdown: QuoteCostBreakdown | null) =>
    breakdown ? formatCurrency(calculateTotalCost(breakdown)) : "Sin registrar";
  push({
    key: "costBreakdown",
    label: "Desglose de costeo",
    group: "valor",
    valueA: costTotal(a.costBreakdown),
    valueB: costTotal(b.costBreakdown),
    detailA: breakdownSummary(a.costBreakdown),
    detailB: breakdownSummary(b.costBreakdown),
    changed: costChanged,
  });

  // ── APU / actividades ──────────────────────────────────────────────────
  const activityChanges = compareRevisionActivities(snapshotA.activities, snapshotB.activities);
  const apuTotalA = snapshotA.activities.reduce((sum, activity) => sum + (activity.totalCost ?? 0), 0);
  const apuTotalB = snapshotB.activities.reduce((sum, activity) => sum + (activity.totalCost ?? 0), 0);
  push({
    key: "apu",
    label: "APU / actividades",
    group: "apu",
    valueA: snapshotA.activities.length
      ? `${snapshotA.activities.length} ${snapshotA.activities.length === 1 ? "actividad" : "actividades"} · ${formatCurrency(apuTotalA)}`
      : "Sin APU registrado",
    valueB: snapshotB.activities.length
      ? `${snapshotB.activities.length} ${snapshotB.activities.length === 1 ? "actividad" : "actividades"} · ${formatCurrency(apuTotalB)}`
      : "Sin APU registrado",
    detailA: snapshotA.activities.length
      ? snapshotA.activities.map((activity) => `${activity.code} ${activity.name}`).join("\n")
      : undefined,
    detailB: snapshotB.activities.length
      ? snapshotB.activities.map((activity) => `${activity.code} ${activity.name}`).join("\n")
      : undefined,
    changed: activityChanges.length > 0,
  });

  // ── Alcance ────────────────────────────────────────────────────────────
  push({
    key: "title",
    label: "Alcance (título de la obra)",
    group: "alcance",
    valueA: textOrEmpty(a.title),
    valueB: textOrEmpty(b.title),
    changed: !sameText(a.title, b.title),
  });
  push({
    key: "notes",
    label: "Notas y observaciones",
    group: "alcance",
    valueA: textOrEmpty(a.notes),
    valueB: textOrEmpty(b.notes),
    changed: !sameText(a.notes, b.notes),
  });

  // ── Condiciones ────────────────────────────────────────────────────────
  push({
    key: "paymentTerms",
    label: "Condiciones de pago",
    group: "condiciones",
    valueA: textOrEmpty(a.paymentTerms),
    valueB: textOrEmpty(b.paymentTerms),
    changed: !sameText(a.paymentTerms, b.paymentTerms),
  });
  push({
    key: "validityDays",
    label: "Vigencia de la oferta",
    group: "condiciones",
    valueA: validitySummary(a.validityDays),
    valueB: validitySummary(b.validityDays),
    changed: !sameNumber(a.validityDays, b.validityDays),
  });
  push({
    key: "deliveryTimeWeeks",
    label: "Plazo de entrega",
    group: "condiciones",
    valueA: deliverySummary(a.deliveryTimeWeeks),
    valueB: deliverySummary(b.deliveryTimeWeeks),
    changed: !sameNumber(a.deliveryTimeWeeks, b.deliveryTimeWeeks),
  });

  // ── Fechas ─────────────────────────────────────────────────────────────
  push({
    key: "receivedAt",
    label: "Fecha de recepción",
    group: "fechas",
    valueA: formatDate(a.receivedAt),
    valueB: formatDate(b.receivedAt),
    changed: a.receivedAt !== b.receivedAt,
  });
  push({
    key: "sentAt",
    label: "Fecha de envío al cliente",
    group: "fechas",
    valueA: formatDate(a.sentAt),
    valueB: formatDate(b.sentAt),
    changed: a.sentAt !== b.sentAt,
  });
  push({
    key: "deadline",
    label: "Fecha límite acordada",
    group: "fechas",
    valueA: formatDate(a.deadline),
    valueB: formatDate(b.deadline),
    changed: a.deadline !== b.deadline,
  });

  const changedCount = rows.filter((row) => row.changed).length;

  let limitation: string | undefined;
  if (options.missing === "left") {
    limitation =
      "No hay instantánea de la revisión izquierda. Las instantáneas se toman cada vez que se guarda la cotización, así que las revisiones anteriores a ese registro no se pueden comparar.";
  } else if (options.missing === "right") {
    limitation =
      "No hay instantánea de la revisión derecha. Guarda la cotización para que esta revisión quede registrada y comparable.";
  }

  return {
    left: { revision: snapshotA.revision, label: revisionLabel(snapshotA.revision), capturedAt: snapshotA.capturedAt },
    right: { revision: snapshotB.revision, label: revisionLabel(snapshotB.revision), capturedAt: snapshotB.capturedAt },
    rows,
    changedCount,
    activityChanges,
    limitation,
  };
}

/** Compara contra una revisión sin foto: todas las filas quedan como cambio. */
export function comparisonWithoutSnapshot(
  revision: number,
  counterpart: QuoteRevisionSnapshot,
  side: "left" | "right",
): RevisionComparison {
  const empty: QuoteRevisionSnapshot = {
    revision,
    capturedAt: new Date().toISOString(),
    activities: [],
    fields: {
      estimatedValue: null,
      costBreakdown: null,
      validityDays: null,
      deliveryTimeWeeks: null,
      paymentTerms: null,
      title: null,
      notes: null,
      status: null,
      receivedAt: null,
      sentAt: null,
      deadline: null,
      updatedAt: null,
    },
  };
  return compareQuoteRevisions(
    side === "left" ? empty : counterpart,
    side === "right" ? empty : counterpart,
    { missing: side },
  );
}