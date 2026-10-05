"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { apuTotal, type Apu } from "@/modules/apu";
import { initialQuotes, type Quote } from "@/modules/quotes";
import { type QuickRental } from "@/modules/rentals";
import {
  inventoryProducts,
  inventoryProjects,
  sampleInitialMovements,
  type InventoryMovement,
  type Project,
  type StockProduct,
} from "../index";
import { prepareRealDataStorage } from "@/shared/browser/real-data-storage";

type ReportKey =
  | "executive"
  | "commercial"
  | "projects"
  | "inventory"
  | "kardex"
  | "critical"
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

function stored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
}

export function ReportsWorkspace({
  initialProducts = [],
}: {
  initialProducts?: StockProduct[];
}) {
  prepareRealDataStorage();
  const [report, setReport] = useState<ReportKey>("executive");
  const [category, setCategory] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [products] = useState<StockProduct[]>(() =>
    stored("rfc_inventory_products", initialProducts),
  );
  const [movements] = useState<InventoryMovement[]>(() =>
    stored("rfc_inventory_movements", []),
  );
  const [projects] = useState<Project[]>(() =>
    stored("rfc_inventory_projects", []),
  );
  const [quotes] = useState<Quote[]>(() => stored("rfc_quotes", []));
  const [apus] = useState<Apu[]>(() => stored("rfc_apus", []));
  const [rentals] = useState<QuickRental[]>(() =>
    stored("rfc_quick_rentals", []),
  );
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
  const relevantMovements = useMemo(
    () =>
      movements.filter(
        (movement) =>
          (projectId === "all" || movement.projectId === projectId) &&
          (category === "all" ||
            products.find((product) => product.id === movement.productId)
              ?.category === category),
      ),
    [movements, projectId, category, products],
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
  const activeRentals = rentals.filter(
    (rental) => rental.status !== "returned",
  );
  const rentalExpected = rentals.reduce(
    (sum, rental) => sum + rental.dailyRate + (rental.extraCharge || 0),
    0,
  );
  const selectedMeta = reportMeta.find((item) => item.key === report)!;

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
        : report === "rentals"
          ? [
              [
                "Código",
                "Equipo",
                "Cliente",
                "Estado",
                "Tarifa día",
                "Garantía",
              ],
              ...rentals.map((rental) => [
                rental.code,
                rental.equipmentName,
                rental.customerName,
                rental.status,
                rental.dailyRate,
                rental.deposit,
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
          Proyecto
          <select
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
        <p>{selectedMeta.description}</p>
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
          detail={`${rentals.length} registros`}
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
              Aún no hay APU guardados en este dispositivo.
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
                  <th>Equipo</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Tarifa / garantía</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((rental) => (
                  <tr key={rental.id}>
                    <td>
                      <strong>{rental.code}</strong>
                    </td>
                    <td>{rental.equipmentName}</td>
                    <td>
                      {rental.customerName}
                      <small>{rental.customerPhone}</small>
                    </td>
                    <td>{rental.status}</td>
                    <td>
                      {cop.format(rental.dailyRate)} /{" "}
                      {cop.format(rental.deposit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rentals.length && (
            <p className="panel-intro">
              Aún no hay alquileres rápidos registrados. Valor esperado
              acumulado: {cop.format(rentalExpected)}.
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
