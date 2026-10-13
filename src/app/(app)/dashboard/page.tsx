import Link from "next/link";
import { enabledModules } from "@/core/modules/catalog";
import { getInventorySnapshot, inventoryRepository } from "@/modules/inventory";

export default async function DashboardPage() {
  const inventory = await getInventorySnapshot(inventoryRepository);

  return (
    <main className="page-content">
      <div className="page-heading"><div><h1>Resumen</h1><p>Base inicial para la operación de Representaciones Figueroa.</p></div><span className="status">Ambiente de desarrollo</span></div>
      <section className="metrics">
        <article className="metric-card"><span>Módulos habilitados</span><strong>{enabledModules.length}</strong><small>Core e Inventarios disponibles</small></article>
        <article className="metric-card"><span>Productos en inventario</span><strong>{inventory.totals.products}</strong><small>{inventory.totals.units} unidades en existencia</small></article>
        <article className="metric-card"><span>Alertas de existencias</span><strong>{inventory.totals.lowStock}</strong><small><Link href="/inventory">Ver inventario</Link></small></article>
      </section>
      <section className="dashboard-grid">
        <article className="panel"><h2>Aplicaciones</h2><p>Los módulos se registran en Core y publican sus rutas sin acoplarse entre sí.</p><div className="module-list">{enabledModules.map((module) => <div className="module-row" key={module.code}><strong>{module.name}</strong><span>v{module.version}</span></div>)}</div></article>
        <article className="panel"><h2>Siguiente paso</h2><p>Conectar el módulo Core/Auth a un proveedor de identidad y persistir empresas, sedes, usuarios, roles y permisos.</p></article>
      </section>
    </main>
  );
}
