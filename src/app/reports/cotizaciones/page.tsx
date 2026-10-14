import { DashboardShell } from "@/app/dashboard-shell";
import { QuoteIndicatorsView } from "@/modules/reports";

/**
 * Indicadores comerciales de Cotizaciones.
 *
 * Ruta propia y aislada: no toca la pantalla de Informes general ni ningún
 * otro módulo, de modo que se puede integrar después sin conflictos de
 * archivos.
 */
export default function QuoteIndicatorsPage() {
  return (
    <DashboardShell>
      <QuoteIndicatorsView />
    </DashboardShell>
  );
}