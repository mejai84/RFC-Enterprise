"use client";

import { useState } from "react";
import type { InventoryRow } from "@/modules/inventory";

const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const query = search.trim().toLowerCase();
  const visible = rows.filter((row) => {
    const matchesQuery = query ? row.product.name.toLowerCase().includes(query) || row.product.sku.toLowerCase().includes(query) : true;
    return matchesQuery && (onlyLowStock ? row.level.lowStock : true);
  });

  return (
    <section className="panel">
      <div className="panel-toolbar">
        <h2>Existencias</h2>
        <div className="toolbar-controls">
          <label className="filter-toggle">
            <input type="checkbox" checked={onlyLowStock} onChange={(event) => setOnlyLowStock(event.target.checked)} />
            Sólo existencias bajas
          </label>
          <input className="filter-input" type="search" value={search} placeholder="Buscar por nombre o SKU" onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty-state">No hay productos que coincidan con el filtro.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>SKU</th><th>Producto</th><th>Categoría</th><th className="numeric">Existencia</th><th className="numeric">Mínimo</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {visible.map(({ product, level }) => (
              <tr key={product.id}>
                <td className="mono">{product.sku}</td>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td className="numeric">{level.quantity} {product.unit}</td>
                <td className="numeric muted">{product.minStock}</td>
                <td>{level.lowStock ? <span className="tag tag-warning">Existencia baja</span> : <span className="tag tag-ok">Suficiente</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="table-footnote">{visible.length} de {rows.length} productos · Actualizado el {dateFormat.format(new Date())}</p>
    </section>
  );
}

export function MovementList({ movements }: { movements: { movement: { id: string; type: "entrada" | "salida"; quantity: number; reason: string; occurredAt: Date }; productName: string }[] }) {
  if (movements.length === 0) return <p className="empty-state">Todavía no hay movimientos registrados.</p>;

  return (
    <ul className="movement-list">
      {movements.map(({ movement, productName }) => (
        <li key={movement.id}>
          <span className={movement.type === "entrada" ? "movement-sign entry" : "movement-sign exit"}>{movement.type === "entrada" ? "+" : "−"}</span>
          <div><strong>{productName}</strong><small>{movement.reason.replace(/_/g, " ")}</small></div>
          <div className="movement-meta"><strong>{movement.quantity}</strong><small>{dateFormat.format(movement.occurredAt)}</small></div>
        </li>
      ))}
    </ul>
  );
}
