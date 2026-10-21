import type { Apu } from "@/modules/apu";
import { daysSince, isStale, type Quote } from "@/modules/quotes";

export type OperationalAlertSeverity = "critical" | "warning" | "info";
export type OperationalAlert = {
  id: string;
  severity: OperationalAlertSeverity;
  source: "Cotizaciones" | "APU" | "Inventario" | "Obras";
  title: string;
  detail: string;
  href: string;
};
export type OperationalAlertInput = {
  quotes: Quote[];
  apus?: Array<Pick<Apu, "quoteId">>;
  linkedApuQuoteIds?: string[];
  products: Array<{ id: string; name: string; available: number; minimum: number | null; unit: string }>;
  projects: Array<{ id: string; code: string; budget: number }>;
  movements: Array<{ projectId?: string; type: "entry" | "exit" | "adjustment" | "return" | "transfer"; totalCost: number }>;
  requisitions: Array<{ id: string; code: string; status: string; projectName: string }>;
};

function daysUntil(isoDate: string) {
  const target = new Date(`${isoDate}T23:59:59`).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

/** Regla única para que Resumen y la campana global muestren las mismas alertas. */
export function buildOperationalAlerts(input: OperationalAlertInput): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const closedStatuses = new Set(["closed", "lost", "work_completed"]);
  const linkedQuoteIds = new Set([
    ...(input.linkedApuQuoteIds ?? []),
    ...(input.apus ?? []).flatMap((apu) => (apu.quoteId ? [apu.quoteId] : [])),
  ]);

  for (const quote of input.quotes.filter(isStale)) {
    const changedAt = quote.history
      .filter(
        (item) =>
          item.toStatus === "awaiting_response" || item.toStatus === "sent",
      )
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt))[0]?.changedAt;
    const days = daysSince(changedAt ?? quote.updatedAt);
    alerts.push({ id: `stale-${quote.id}`, severity: days >= 7 ? "critical" : "warning", source: "Cotizaciones", title: `${quote.code} sin respuesta`, detail: `Lleva ${days} días esperando respuesta del cliente.`, href: "/quotes" });
  }
  for (const quote of input.quotes) {
    if (!quote.deadline || closedStatuses.has(quote.status)) continue;
    const remaining = daysUntil(quote.deadline);
    if (remaining < 0) alerts.push({ id: `overdue-${quote.id}`, severity: "critical", source: "Cotizaciones", title: `${quote.code} vencida`, detail: `La fecha límite venció hace ${Math.abs(remaining)} días.`, href: "/quotes" });
    else if (remaining <= 2) alerts.push({ id: `due-${quote.id}`, severity: "warning", source: "Cotizaciones", title: `${quote.code} vence pronto`, detail: remaining === 0 ? "La entrega vence hoy." : `La entrega vence en ${remaining} días.`, href: "/quotes" });
  }
  for (const quote of input.quotes.filter((item) => (item.status === "estimating" || item.status === "revision_requested") && !linkedQuoteIds.has(item.id))) {
    alerts.push({ id: `apu-${quote.id}`, severity: "warning", source: "APU", title: `${quote.code} requiere APU`, detail: "Está en proceso de cotización y aún no tiene análisis de precios.", href: `/apu?quoteId=${encodeURIComponent(quote.id)}&quoteCode=${encodeURIComponent(quote.code)}&quoteTitle=${encodeURIComponent(quote.title)}` });
  }

  const criticalProducts = input.products
    .filter((product) => product.minimum !== null && product.available <= product.minimum)
    .map((product) => ({ ...product, deficit: (product.minimum ?? 0) - product.available }))
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 3);
  for (const item of criticalProducts) {
    alerts.push({ id: `stock-${item.id}`, severity: item.available <= 0 ? "critical" : "warning", source: "Inventario", title: `${item.name} bajo mínimo`, detail: item.available <= 0 ? "No hay existencias disponibles." : `Faltan ${item.deficit} ${item.unit} para el mínimo.`, href: "/inventory?tab=low-stock" });
  }

  for (const project of input.projects) {
    const spent = input.movements.filter((movement) => movement.projectId === project.id).reduce((total, movement) => {
      if (movement.type === "exit") return total + movement.totalCost;
      if (movement.type === "return") return total - movement.totalCost;
      return total;
    }, 0);
    const progressPercent = project.budget > 0 ? Math.min(Math.round((spent / project.budget) * 100), 100) : 0;
    if (progressPercent < 80) continue;
    alerts.push({ id: `project-${project.id}`, severity: progressPercent >= 100 ? "critical" : "warning", source: "Obras", title: `${project.code} ${progressPercent >= 100 ? "supera" : "alcanza"} presupuesto`, detail: `${progressPercent}% del presupuesto de materiales comprometido.`, href: "/projects" });
  }
  for (const requisition of input.requisitions.filter((item) => item.status === "pending").slice(0, 2)) {
    alerts.push({ id: `req-${requisition.id}`, severity: "info", source: "Inventario", title: `${requisition.code} pendiente`, detail: `Requisición para ${requisition.projectName} esperando despacho.`, href: "/inventory?tab=movements" });
  }

  const weight: Record<OperationalAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => weight[a.severity] - weight[b.severity]);
}
