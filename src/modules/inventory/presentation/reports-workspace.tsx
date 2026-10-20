"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { apuTotal, listApuAnalyses, type Apu } from "@/modules/apu";
import { loadQuotesWorkspaceData, type Quote } from "@/modules/quotes";
import {
  listQuickRentalOrders,
  quickRentalDisplayStatus,
  quickRentalOrderDepositTotal,
  quickRentalOrderPendingQuantity,
  quickRentalOrderRentTotal,
  quickRentalStatusLabels,
  type QuickRentalOrder,
} from "@/modules/rentals";
import type { InventoryMovement, Project, StockProduct } from "../index";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import {
  buildConsumptionByProject,
  buildIdleStockReport,
  buildRotationReport,
  buildValuationByGroup,
  movementsWithinPeriod,
  totalValuation,
  type ReportPeriodDays,
} from "../domain/report-metrics";

type ReportKey =
  | "executive"
  | "commercial"
  | "projects"
  | "inventory"
  | "kardex"
  | "critical"
  | "consumption"
  | "rotation"
  | "idle"
  | "valuation"
  | "apu"
  | "rentals";
type ReportGroup = "Gerenciales" | "Operativos" | "Financieros";
const reportMeta: Array<{
  key: ReportKey;
  label: string;
  group: ReportGroup;
  description: string;
}> = [
  {
    key: "executive",
    label: "Resumen ejecutivo",
    group: "Gerenciales",
    description: "Panorama de ventas, inventario, proyectos y alquileres.",
  },
  {
    key: "commercial",
    label: "Pipeline de cotizaciones",
    group: "Gerenciales",
    description: "Valor comercial y seguimiento de oportunidades.",
  },
  {
    key: "projects",
    label: "Ejecución por proyecto",
    group: "Financieros",
    description: "Presupuesto frente a salidas registradas.",
  },
  {
    key: "inventory",
    label: "Inventario valorizado",
    group: "Financieros",
    description: "Existencias y valor económico almacenado.",
  },
  {
    key: "kardex",
    label: "Kardex valorizado",
    group: "Operativos",
    description: "Entradas y salidas con su trazabilidad.",
  },
  {
    key: "consumption",
    label: "Consumo por obra",
    group: "Operativos",
    description: "Salidas valorizadas agrupadas por proyecto u obra.",
  },
  {
    key: "rotation",
    label: "Rotación de inventario",
    group: "Operativos",
    description: "Salidas del periodo frente a la existencia actual.",
  },
  {
    key: "idle",
    label: "Stock inmovilizado",
    group: "Operativos",
    description: "Referencias con existencia y sin salidas en el periodo.",
  },
  {
    key: "valuation",
    label: "Valoración por grupo",
    group: "Financieros",
    description: "Valor económico por Bodega, Dotación y Trabajadores.",
  },
  {
    key: "critical",
    label: "Stock crítico",
    group: "Operativos",
    description: "Artículos por reponer antes de afectar la operación.",
  },
  {
    key: "apu",
    label: "APU y estimaciones",
    group: "Financieros",
    description: "Actividades y costos estimados guardados.",
  },
  {
    key: "rentals",
    label: "Alquileres rápidos",
    group: "Operativos",
    description: "Equipos entregados, garantías y devoluciones.",
  },
];
const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const collator = new Intl.Collator("es-CO", { sensitivity: "base" });

export function ReportsWorkspace({
  initialProducts = [],
}: {
  initialProducts?: StockProduct[];
}) {
  const [report, setReport] = useState<ReportKey>("executive");
  const [category, setCategory] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [periodDays, setPeriodDays] = useState<ReportPeriodDays>(90);
  const [now] = useState(() => Date.now());
  const [products] = useState<StockProduct[]>(initialProducts);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [apus, setApus] = useState<Apu[]>([]);
  const [rentals, setRentals] = useState<QuickRentalOrder[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return;
    const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
    void (async () => {
      const [
        { data: remoteProjects },
        { data: remoteMovements },
        quoteWorkspace,
        remoteApus,
        rentalOrders,
      ] = await Promise.all([
        supabase.from("projects").select("id,code,name,client,location,material_budget,status,start_date,estimated_end_date,actual_end_date,created_at").order("created_at", { ascending: false }),
        supabase.from("inventory_movements").select("id,stock_id,movement_type,quantity,unit_cost,reference,notes,occurred_at,project_id,inventory_stock!inner(inventory_items!inner(name,unit)),projects(name)").order("occurred_at", { ascending: false }),
        // Las cotizaciones se leen con el repositorio del módulo para conservar
        // client, estimatedValue y el resto del contrato (no un cast de filas).
        loadQuotesWorkspaceData().catch(() => null),
        // Los APU se leen mapeados desde el módulo (snake_case → camelCase) para
        // conservar quoteCode/quoteId y calcular el total de cada análisis.
        listApuAnalyses().catch(() => [] as Apu[]),
        listQuickRentalOrders().catch(() => [] as QuickRentalOrder[]),
      ]);
      if (remoteProjects) setProjects(remoteProjects.map((project) => ({ id: project.id, code: project.code, name: project.name, client: project.client, location: project.location ?? "Sin ubicación", budget: Number(project.material_budget), status: project.status as Project["status"], type: project.code.startsWith("MANT-") ? "mantenimiento" : "obra", createdAt: project.created_at, startDate: project.start_date, estimatedEndDate: project.estimated_end_date, actualEndDate: project.actual_end_date })));
      if (remoteMovements) setMovements(remoteMovements.map((movement) => { const stock = Array.isArray(movement.inventory_stock) ? movement.inventory_stock[0] : movement.inventory_stock; const item = stock && (Array.isArray(stock.inventory_items) ? stock.inventory_items[0] : stock.inventory_items); const project = Array.isArray(movement.projects) ? movement.projects[0] : movement.projects; return { id: movement.id, productId: movement.stock_id, productName: item?.name, type: movement.movement_type === "entry" ? "entry" : movement.movement_type === "exit" ? "exit" : "adjustment", quantity: Number(movement.quantity), unit: item?.unit, unitCost: Number(movement.unit_cost), totalCost: Number(movement.quantity) * Number(movement.unit_cost), occurredAt: movement.occurred_at, reference: movement.reference, projectId: movement.project_id ?? undefined, projectName: project?.name, notes: movement.notes ?? undefined }; }));
      if (quoteWorkspace) setQuotes(quoteWorkspace.quotes);
      setApus(remoteApus);
      setRentals(rentalOrders);
    })();
  }, []);
  const categories = useMemo(
    () =>
      [
        ...new Set(products.map((product) => product.category).filter(Boolean)),
      ].sort(collator.compare),
    [products],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) => category === "all" || product.category === category,
      ),
    [products, category],
  );
  const categoryMovements = useMemo(
    () =>
      movements.filter(
        (movement) =>
          category === "all" ||
          products.find((product) => product.id === movement.productId)
            ?.category === category,
      ),
    [movements, category, products],
  );
  const relevantMovements = useMemo(
    () =>
      categoryMovements.filter(
        (movement) => projectId === "all" || movement.projectId === projectId,
      ),
    [categoryMovements, projectId],
  );
  const periodMovements = useMemo(
    () => movementsWithinPeriod(relevantMovements, periodDays, now),
    [relevantMovements, periodDays, now],
  );
  const periodOutputValue = useMemo(
    () =>
      periodMovements
        .filter((movement) => movement.type === "exit")
        .reduce((sum, movement) => sum + movement.totalCost, 0),
    [periodMovements],
  );
  const consumptionRows = useMemo(
    () => buildConsumptionByProject(relevantMovements, projects, periodDays, now),
    [relevantMovements, projects, periodDays, now],
  );
  // La rotación y el inmovilizado miran el inventario completo de la categoría:
  // el filtro de proyecto solo tiene sentido para consumo y ejecución por obra.
  const rotationRows = useMemo(
    () => buildRotationReport(filteredProducts, categoryMovements, periodDays, now),
    [filteredProducts, categoryMovements, periodDays, now],
  );
  const idleRows = useMemo(
    () => buildIdleStockReport(filteredProducts, categoryMovements, periodDays, now),
    [filteredProducts, categoryMovements, periodDays, now],
  );
  const valuationRows = useMemo(
    () => buildValuationByGroup(filteredProducts),
    [filteredProducts],
  );
  const valuationTotal = useMemo(() => totalValuation(valuationRows), [valuationRows]);
  const idleValue = useMemo(
    () => idleRows.reduce((sum, row) => sum + row.value, 0),
    [idleRows],
  );
  const inventoryValue = filteredProducts.reduce(
    (sum, product) => sum + product.available * (product.unitCost || 0),
    0,
  );
  const outputs = relevantMovements.filter(
    (movement) => movement.type === "exit",
  );
  const projectRows = projects
    .map((project) => ({
      ...project,
      spent: outputs
        .filter((movement) => movement.projectId === project.id)
        .reduce((sum, movement) => sum + movement.totalCost, 0),
    }))
    .filter((project) => projectId === "all" || project.id === projectId)
    .sort((a, b) => b.spent - a.spent);
  const critical = filteredProducts.filter(
    (product) =>
      product.available <= 0 ||
      (product.minimum !== null && product.available <= product.minimum),
  );
  const openQuotes = quotes.filter(
    (quote) =>
      !["lost", "closed", "work_completed", "billing_pending"].includes(
        quote.status,
      ),
  );
  const pipelineValue = openQuotes.reduce(
    (sum, quote) => sum + (quote.estimatedValue || 0),
    0,
  );
  const confirmedQuotes = quotes.filter((quote) =>
    [
      "confirmed",
      "in_execution",
      "work_completed",
      "billing_pending",
      "closed",
    ].includes(quote.status),
  );
  const activeRentals = rentals.filter((order) => order.status !== "returned");
  const rentalExpected = rentals.reduce(
    (sum, order) => sum + quickRentalOrderRentTotal(order),
    0,
  );
  const rentalUnits = activeRentals.reduce(
    (sum, order) => sum + quickRentalOrderPendingQuantity(order),
    0,
  );
  const selectedMeta = reportMeta.find((item) => item.key === report)!;
  const periodLabel =
    periodDays === 0 ? "histórico completo" : `últimos ${periodDays} días`;
  const projectFilterApplies = [
    "executive",
    "projects",
    "kardex",
    "consumption",
  ].includes(report);
  const periodFilterApplies = ["consumption", "rotation", "idle"].includes(
    report,
  );

  function exportCsv() {
    const rows =
      report === "commercial"
        ? [
            ["Código", "Cliente", "Estado", "Valor"],
            ...quotes.map((quote) => [
              quote.code,
              quote.client,
              quote.status,
              quote.estimatedValue || 0,
            ]),
          ]
        : report === "consumption"
          ? [
              ["Obra", "Código", "Movimientos", "Unidades", "Valor", "Última salida"],
              ...consumptionRows.map((row) => [
                row.projectName,
                row.projectCode,
                row.movements,
                row.quantity,
                row.value,
                row.lastExitAt ?? "",
              ]),
            ]
          : report === "rotation"
            ? [
                ["SKU", "Artículo", "Existencia", "Salidas", "Rotación", "Valor salidas", "Última salida"],
                ...rotationRows.map((row) => [
                  row.sku,
                  row.name,
                  row.available,
                  row.exits,
                  row.rotation === null ? "" : row.rotation.toFixed(2),
                  row.exitsValue,
                  row.lastExitAt ?? "",
                ]),
              ]
            : report === "idle"
              ? [
                  ["SKU", "Artículo", "Grupo", "Existencia", "Valor", "Última salida", "Días sin salida"],
                  ...idleRows.map((row) => [
                    row.sku,
                    row.name,
                    row.inventoryGroupName,
                    row.available,
                    row.value,
                    row.lastExitAt ?? "",
                    row.daysIdle ?? "",
                  ]),
                ]
              : report === "valuation"
                ? [
                    ["Grupo", "Referencias", "Unidades", "Valor", "% del total"],
                    ...valuationRows.map((row) => [
                      row.groupName,
                      row.references,
                      row.units,
                      row.value,
                      valuationTotal > 0 ? ((row.value / valuationTotal) * 100).toFixed(1) : "0.0",
                    ]),
                  ]
                : report === "rentals"
                  ? [
                      ["Código", "Equipos", "Cliente", "Estado", "Renta", "Garantía", "Unidades pendientes"],
                      ...rentals.map((order) => [
                        order.code,
                        order.lines.map((line) => line.equipmentName).join(" | "),
                        order.customerName,
                        quickRentalStatusLabels[quickRentalDisplayStatus(order, now)],
                        quickRentalOrderRentTotal(order),
                        quickRentalOrderDepositTotal(order),
                        quickRentalOrderPendingQuantity(order),
                      ]),
                    ]
                  : report === "apu"
            ? [
                ["Código", "Actividad", "Cotización", "Total"],
                ...apus.map((apu) => [
                  apu.code,
                  apu.name,
                  apu.quoteCode || "",
                  apuTotal(apu),
                ]),
              ]
            : [
                [
                  "SKU",
                  "Artículo",
                  "Categoría",
                  "Ubicación",
                  "Existencia",
                  "Unidad",
                  "Valor",
                ],
                ...filteredProducts.map((product) => [
                  product.sku,
                  product.name,
                  product.category,
                  product.location,
                  product.available,
                  product.unit,
                  product.available * (product.unitCost || 0),
                ]),
              ];
    const text = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(";"),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([`\ufeff${text}`], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `RFC_${report}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="dashboard-content report-document" id="main-content">
      <header className="report-print-header">
        <Image src="/rfc-logo.svg" alt="Logo RFC" width={48} height={48} />
        <div>
          <strong>REPRESENTACIONES FIGUEROA CASTRO S.A.S.</strong>
          <small>{selectedMeta.label}</small>
        </div>
      </header>
      <section className="dashboard-heading">
        <div>
          <p>Dirección · RFC Enterprise</p>
          <h1>Centro de informes</h1>
          <small>Elija un informe según la decisión que necesita tomar.</small>
        </div>
        <div className="row-actions no-print">
          <button
            className="inventory-action"
            onClick={exportCsv}
            type="button"
          >
            Exportar Excel CSV
          </button>
          <button
            className="btn-row-action"
            onClick={() => window.print()}
            type="button"
          >
            PDF / Imprimir
          </button>
        </div>
      </section>
      <section
        className="report-catalog no-print"
        aria-label="Tipos de informe"
      >
        {(["Gerenciales", "Operativos", "Financieros"] as ReportGroup[]).map(
          (group) => (
            <div key={group}>
              <p>{group}</p>
              <div>
                {reportMeta
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      className={report === item.key ? "is-active" : ""}
                      onClick={() => setReport(item.key)}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </button>
                  ))}
              </div>
            </div>
          ),
        )}
      </section>
      <section className="report-controls dashboard-panel no-print">
        <label>
          Categoría
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Proyecto {projectFilterApplies ? "" : "(no aplica a este informe)"}
          <select
            disabled={!projectFilterApplies}
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="all">Todos los proyectos</option>
            {[...projects]
              .sort((a, b) => collator.compare(a.name, b.name))
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Periodo de análisis{" "}
          {periodFilterApplies ? "" : "(no aplica a este informe)"}
          <select
            disabled={!periodFilterApplies}
            value={periodDays}
            onChange={(event) =>
              setPeriodDays(Number(event.target.value) as ReportPeriodDays)
            }
          >
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={365}>Últimos 12 meses</option>
            <option value={0}>Histórico completo</option>
          </select>
        </label>
        <p style={{ gridColumn: "1 / -1" }}>{selectedMeta.description}</p>
      </section>
      <section className="report-kpis">
        <Card
          label="Valor de inventario"
          value={cop.format(inventoryValue)}
          detail={`${filteredProducts.length} referencias`}
        />
        <Card
          label="Pipeline comercial"
          value={cop.format(pipelineValue)}
          detail={`${openQuotes.length} oportunidades activas`}
        />
        <Card
          label="Alquileres activos"
          value={String(activeRentals.length)}
          detail={`${rentalUnits} unidad(es) fuera de bodega`}
        />
        <Card
          label="Stock crítico"
          value={String(critical.length)}
          detail={critical.length ? "requiere atención" : "sin alertas"}
          critical={Boolean(critical.length)}
        />
      </section>
      {(report === "executive" || report === "commercial") && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Comercial" title="Cotizaciones y pipeline" />
          <div className="inventory-table-container">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Valor estimado</th>
                </tr>
              </thead>
              <tbody>
                {quotes.slice(0, 15).map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <strong>{quote.code}</strong>
                    </td>
                    <td>{quote.client}</td>
                    <td>{quote.status}</td>
                    <td>{cop.format(quote.estimatedValue || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-intro">
            {confirmedQuotes.length} cotizaciones confirmadas o en ejecución.
          </p>
        </section>
      )}
      {(report === "executive" || report === "projects") && (
        <section className="dashboard-panel report-chart">
          <PanelTitle eyebrow="Financiero" title="Ejecución por proyecto" />
          {projectRows.map((project) => (
            <ProgressRow
              key={project.id}
              label={`${project.code} · ${project.name}`}
              value={project.spent}
              max={Math.max(project.budget, project.spent, 1)}
              detail={`${cop.format(project.spent)} de ${cop.format(project.budget)}`}
            />
          ))}
        </section>
      )}
      {(report === "executive" || report === "inventory") && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Inventario" title="Inventario valorizado" />
          <InventoryTable
            rows={[...filteredProducts]
              .sort(
                (a, b) =>
                  b.available * (b.unitCost || 0) -
                  a.available * (a.unitCost || 0),
              )
              .slice(0, 20)}
            empty="No hay artículos con los filtros actuales."
          />
        </section>
      )}
      {report === "consumption" && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Consumo" title="Salidas valorizadas por obra" />
          {consumptionRows.length ? (
            <div className="inventory-table-container">
              <table className="inventory-data-table">
                <thead>
                  <tr>
                    <th>Obra / proyecto</th>
                    <th>Movimientos</th>
                    <th>Unidades</th>
                    <th>Valor</th>
                    <th>Última salida</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptionRows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <strong>{row.projectName}</strong>
                        <small>{row.projectCode}</small>
                      </td>
                      <td>{row.movements}</td>
                      <td>{row.quantity}</td>
                      <td>{cop.format(row.value)}</td>
                      <td>
                        {row.lastExitAt
                          ? new Date(row.lastExitAt).toLocaleDateString("es-CO")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-intro">
              No hay salidas registradas para {periodLabel} con los filtros actuales.
            </p>
          )}
          <p className="panel-intro">
            Periodo: {periodLabel}. Valor de salidas del periodo:{" "}
            <strong>{cop.format(periodOutputValue)}</strong>.
          </p>
        </section>
      )}
      {report === "rotation" && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Rotación" title="Salidas frente a existencia actual" />
          {rotationRows.length ? (
            <div className="inventory-table-container">
              <table className="inventory-data-table">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th>Existencia</th>
                    <th>Salidas</th>
                    <th>Índice</th>
                    <th>Valor salidas</th>
                    <th>Última salida</th>
                  </tr>
                </thead>
                <tbody>
                  {rotationRows.map((row) => (
                    <tr key={row.productId}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>
                          {row.sku} · {row.category}
                        </small>
                      </td>
                      <td>
                        {row.available} {row.unit}
                      </td>
                      <td>{row.exits}</td>
                      <td>
                        <strong>{row.rotation === null ? "—" : row.rotation.toFixed(2)}</strong>
                      </td>
                      <td>{cop.format(row.exitsValue)}</td>
                      <td>
                        {row.lastExitAt
                          ? new Date(row.lastExitAt).toLocaleDateString("es-CO")
                          : "Sin salidas"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-intro">
              No hay referencias con existencia o salidas para {periodLabel}.
            </p>
          )}
          <p className="panel-intro">
            Índice = unidades salidas en {periodLabel} ÷ existencia actual. Es un indicador
            operativo; el sistema aún no guarda fotografías históricas de existencias para
            calcular un costo de ventas contable.
          </p>
        </section>
      )}
      {report === "idle" && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Inmovilizado" title="Stock sin salidas en el periodo" />
          {idleRows.length ? (
            <div className="inventory-table-container">
              <table className="inventory-data-table">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th>Grupo</th>
                    <th>Existencia</th>
                    <th>Valor</th>
                    <th>Última salida</th>
                    <th>Días sin salida</th>
                  </tr>
                </thead>
                <tbody>
                  {idleRows.map((row) => (
                    <tr key={row.productId}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>
                          {row.sku} · {row.category}
                        </small>
                      </td>
                      <td>{row.inventoryGroupName}</td>
                      <td>
                        {row.available} {row.unit}
                      </td>
                      <td>{cop.format(row.value)}</td>
                      <td>
                        {row.lastExitAt
                          ? new Date(row.lastExitAt).toLocaleDateString("es-CO")
                          : "Sin salidas registradas"}
                      </td>
                      <td>{row.daysIdle === null ? "—" : `${row.daysIdle} días`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-intro">
              No hay referencias inmovilizadas en {periodLabel} con los filtros actuales.
            </p>
          )}
          <p className="panel-intro">
            Valor inmovilizado: <strong>{cop.format(idleValue)}</strong>. Se consideran
            referencias con existencia y sin salidas en {periodLabel}.
          </p>
        </section>
      )}
      {report === "valuation" && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Valoración" title="Inventario por grupo" />
          {valuationRows.length ? (
            <div className="inventory-table-container">
              <table className="inventory-data-table">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Referencias</th>
                    <th>Unidades</th>
                    <th>Valor</th>
                    <th>% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {valuationRows.map((row) => (
                    <tr key={row.group}>
                      <td>
                        <strong>{row.groupName}</strong>
                      </td>
                      <td>{row.references}</td>
                      <td>{row.units}</td>
                      <td>{cop.format(row.value)}</td>
                      <td>
                        {valuationTotal > 0
                          ? `${((row.value / valuationTotal) * 100).toFixed(1)} %`
                          : "0.0 %"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-intro">No hay existencias valorizadas con los filtros actuales.</p>
          )}
          <p className="panel-intro">
            Valor total: <strong>{cop.format(valuationTotal)}</strong>. La valoración usa
            existencia × costo unitario persistido en la bodega.
          </p>
        </section>
      )}
      {report === "kardex" && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Trazabilidad" title="Kardex valorizado" />
          <div className="inventory-table-container">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Artículo</th>
                  <th>Tipo</th>
                  <th>Proyecto</th>
                  <th>Cantidad</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {relevantMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.occurredAt}</td>
                    <td>
                      <strong>{movement.productName}</strong>
                      <small>{movement.reference}</small>
                    </td>
                    <td>{movement.type}</td>
                    <td>{movement.projectName || "Bodega"}</td>
                    <td>
                      {movement.quantity} {movement.unit}
                    </td>
                    <td>{cop.format(movement.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {report === "critical" && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Operación" title="Materiales críticos" />
          <InventoryTable rows={critical} empty="No hay artículos críticos." />
        </section>
      )}
      {report === "apu" && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Estimación" title="APU guardados" />
          <div className="inventory-table-container">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Actividad</th>
                  <th>Cotización</th>
                  <th>Valor directo</th>
                </tr>
              </thead>
              <tbody>
                {apus.map((apu) => (
                  <tr key={apu.id}>
                    <td>
                      <strong>{apu.code}</strong>
                    </td>
                    <td>{apu.name}</td>
                    <td>{apu.quoteCode || "General"}</td>
                    <td>{cop.format(apuTotal(apu))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!apus.length && (
            <p className="panel-intro">
              Aún no hay APU guardados en la base de datos.
            </p>
          )}
        </section>
      )}
      {report === "rentals" && (
        <section className="dashboard-panel report-table">
          <PanelTitle eyebrow="Custodia comercial" title="Alquileres rápidos" />
          <div className="inventory-table-container">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>Consecutivo</th>
                  <th>Equipos</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Renta / garantía</th>
                  <th>Pendientes</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.code}</strong>
                    </td>
                    <td>
                      {order.lines.map((line) => line.equipmentName).join(" · ")}
                      <small>{order.lines.length} línea(s)</small>
                    </td>
                    <td>
                      {order.customerName}
                      <small>{order.customerPhone}</small>
                    </td>
                    <td>
                      {quickRentalStatusLabels[quickRentalDisplayStatus(order, now)]}
                    </td>
                    <td>
                      {cop.format(quickRentalOrderRentTotal(order))} /{" "}
                      {cop.format(quickRentalOrderDepositTotal(order))}
                    </td>
                    <td>{quickRentalOrderPendingQuantity(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rentals.length && (
            <p className="panel-intro">
              Aún no hay alquileres rápidos registrados. Renta acumulada:{" "}
              {cop.format(rentalExpected)}.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function Card({
  label,
  value,
  detail,
  critical = false,
}: {
  label: string;
  value: string;
  detail: string;
  critical?: boolean;
}) {
  return (
    <article className={critical ? "is-critical" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-title">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}
function ProgressRow({
  label,
  value,
  max,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  detail: string;
}) {
  return (
    <div className="report-bar">
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <div className="report-bar-track">
        <i
          style={{
            width: `${Math.max(4, Math.min(100, (value / max) * 100))}%`,
          }}
        />
      </div>
    </div>
  );
}
function InventoryTable({
  rows,
  empty,
}: {
  rows: StockProduct[];
  empty: string;
}) {
  return rows.length ? (
    <div className="inventory-table-container">
      <table className="inventory-data-table">
        <thead>
          <tr>
            <th>Artículo</th>
            <th>Ubicación</th>
            <th>Existencia</th>
            <th>Mínimo</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((product) => (
            <tr key={product.id}>
              <td>
                <strong>{product.name}</strong>
                <small>
                  {product.sku} · {product.brand}
                </small>
              </td>
              <td>{product.location}</td>
              <td>
                {product.available} {product.unit}
              </td>
              <td>
                {product.minimum === null
                  ? "—"
                  : `${product.minimum} ${product.unit}`}
              </td>
              <td>{cop.format(product.available * (product.unitCost || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="panel-intro">{empty}</p>
  );
}
