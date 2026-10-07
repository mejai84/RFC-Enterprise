import type { Project } from "./project";

/**
 * Condiciones economicas de un proyecto de tipo Alquiler (ALQ-001).
 * Se guardan en `projects.rental_*` y solo aplican cuando el tipo es "alquiler".
 */
export type ProjectRentalTerms = {
  /** Tarifa pactada por dia de alquiler del equipo. */
  dailyRate?: number;
  /** Cargo adicional por cada dia de extension sobre el periodo pactado. */
  extensionRate?: number;
  /** Cargo por dia de mora cuando la devolucion se pasa de la fecha pactada. */
  lateFeePerDay?: number;
  /** Condiciones particulares: deposito, responsabilidad por danos, uso autorizado. */
  notes?: string;
};

export type RentalPeriodSummary = {
  /** Dias de calendario entre la entrega y la devolucion pactada (minimo 1). */
  contractedDays: number;
  /** Dias efectivamente transcurridos hasta la devolucion real; null si sigue entregado. */
  elapsedDays: number | null;
  /** Dias cobrados de mas por extension, sobre el periodo pactado. */
  extensionDays: number;
  /** Dias de mora respecto de la fecha pactada de devolucion. */
  lateDays: number;
  /** Valor del alquiler por el periodo efectivamente cobrado. */
  rentalAmount: number;
  /** Cargo por extension. */
  extensionAmount: number;
  /** Cargo por mora. */
  lateFeeAmount: number;
  /** Total a facturar por el alquiler. */
  total: number;
  /** Saldo a favor de la empresa cuando la devolucion ya ocurrio. */
  closed: boolean;
};

const MS_PER_DAY = 86_400_000;

function parseDate(value?: string): number | null {
  if (!value) return null;
  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(time) ? null : time;
}

function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.round((to - from) / MS_PER_DAY));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula el periodo de entrega y devolucion de un proyecto de alquiler.
 * Mientras el equipo sigue entregado se proyecta con la fecha pactada; al cerrar
 * se usa la devolucion real para determinar extension y mora.
 */
export function computeRentalPeriod(
  project: Pick<Project, "startDate" | "estimatedEndDate" | "actualEndDate">,
  terms: ProjectRentalTerms = {},
): RentalPeriodSummary {
  const pickup = parseDate(project.startDate);
  const due = parseDate(project.estimatedEndDate);

  if (pickup === null || due === null) {
    return {
      contractedDays: 0, elapsedDays: null, extensionDays: 0, lateDays: 0,
      rentalAmount: 0, extensionAmount: 0, lateFeeAmount: 0, total: 0, closed: false,
    };
  }

  const contractedDays = daysBetween(pickup, due) + 1;
  const closed = project.actualEndDate !== undefined && project.actualEndDate !== null && project.actualEndDate !== "";
  const returned = closed ? parseDate(project.actualEndDate) : null;
  const elapsedDays = returned !== null ? daysBetween(pickup, returned) + 1 : null;

  // El periodo facturable nunca baja del periodo pactado: una entrega anticipada
  // no genera descuento automatico, el ajuste se hace con la nota de condiciones.
  const billableDays = elapsedDays ?? contractedDays;
  const extensionDays = Math.max(0, billableDays - contractedDays);
  const lateDays = returned !== null && due !== null ? Math.max(0, daysBetween(due, returned)) : 0;

  const dailyRate = Number(terms.dailyRate ?? 0);
  const extensionRate = Number(terms.extensionRate ?? 0);
  const lateFeePerDay = Number(terms.lateFeePerDay ?? 0);

  const rentalAmount = roundMoney(billableDays * dailyRate);
  const extensionAmount = roundMoney(extensionDays * extensionRate);
  const lateFeeAmount = roundMoney(lateDays * lateFeePerDay);

  return {
    contractedDays,
    elapsedDays,
    extensionDays,
    lateDays,
    rentalAmount,
    extensionAmount,
    lateFeeAmount,
    total: roundMoney(rentalAmount + extensionAmount + lateFeeAmount),
    closed: closed && returned !== null,
  };
}

/** Redondea a pesos, con dos decimales, para persistir en numeric(14,2). */
export function toRentalMoney(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return roundMoney(parsed);
}