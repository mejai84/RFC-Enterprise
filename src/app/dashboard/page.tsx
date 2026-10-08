import { DashboardExecutiveWorkspace } from "@/modules/inventory/presentation/dashboard-executive-workspace";
import { RentalsSummaryCard } from "@/modules/rentals/presentation/rentals-summary-card";
import { AttendanceSummaryCard } from "@/modules/attendance/presentation/attendance-summary-card";
import { getInventoryProducts } from "@/modules/inventory/application/get-inventory-products";

export const metadata = {
  title: "Dashboard Ejecutivo de Obras y Materiales | RFC Enterprise",
  description:
    "Resumen de la operación: obras, materiales, cotizaciones, alquileres y mi jornada.",
};

/**
 * El Resumen se compone en la capa de aplicación: cada tarjeta viene de su módulo
 * y se muestra según los permisos efectivos de quien mira, de modo que un
 * trabajador ve su jornada y un gerente ve además los indicadores financieros.
 */
export default async function DashboardPage() {
  const inventory = await getInventoryProducts();
  // El shell lo pone `dashboard/layout.tsx`. Si se envolviera aqui tambien, la
  // barra lateral y la cabecera aparecerian duplicadas.
  // El saludo y los indicadores ejecutivos van primero. Las tarjetas personales
  // (mi jornada, alquileres) se muestran despues: un gerente las busca abajo y un
  // trabajador las encuentra cuando mira hacia el final del bloque.
  return (
    <>
      <DashboardExecutiveWorkspace initialProducts={inventory.products ?? []} />
      <div className="exec-summary-grid">
        <AttendanceSummaryCard />
        <RentalsSummaryCard />
      </div>
    </>
  );
}