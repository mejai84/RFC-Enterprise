import Link from "next/link";
import { getInventorySnapshot, inventoryRepository } from "@/modules/inventory";
import { InventoryTable, MovementList } from "./inventory-table";

/**
 * Ruta pública del módulo. La página sólo compone el contrato de
 * `src/modules/inventory`; la lógica de existencias vive en el módulo.
 */
export default function InventoryPage() {
  return <InventoryView />;
}

async function InventoryView() {
  const snapshot = await getInventorySnapshot(inventoryRepository);

  return (
    <main className="page-content">
      <div className="page-heading">
        <div><h1>Inventarios</h1><p>Existencias por producto en la sede principal, derivadas de los movimientos registrados.</p></div>
        <Link className="status" href="/dashboard">Volver al resumen</Link>
      </div>

      <section className="metrics">
        <article className="metric-card"><span>Productos activos</span><strong>{snapshot.totals.products}</strong><small>Catálogo habilitado</small></article>
        <article className="metric-card"><span>Unidades en existencia</span><strong>{snapshot.totals.units}</strong><small>Entradas menos salidas</small></article>
        <article className="metric-card"><span>Existencias bajas</span><strong>{snapshot.totals.lowStock}</strong><small>Por debajo del mínimo estimado</small></article>
      </section>

      <div className="inventory-layout">
        <InventoryTable rows={snapshot.rows} />
        <section className="panel">
          <h2>Movimientos recientes</h2>
          <MovementList movements={snapshot.lastMovements} />
          <p className="panel-note">El registro de movimientos requiere sesión autenticada y persistencia; por ahora el módulo opera con datos de ejemplo en memoria.</p>
        </section>
      </div>
    </main>
  );
}
