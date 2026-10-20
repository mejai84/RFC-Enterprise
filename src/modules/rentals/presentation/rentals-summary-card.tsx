"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEffectivePermissions } from "@/core/permissions/use-effective-permissions";
import { listQuickRentalOrders } from "../data/quick-rental-order-repository";
import {
  quickRentalOrderPendingQuantity,
  type QuickRentalOrder,
} from "../domain/quick-rental-order";

/**
 * Resumen de alquileres dentro del Resumen.
 *
 * Lee los documentos multi-línea de Supabase y cuenta las unidades que
 * siguen fuera de bodega. Solo lo ve quien tiene permiso de consulta de
 * alquileres. No consulta la tabla histórica `quick_rentals`.
 */
export function RentalsSummaryCard() {
  const { permissions, isLoading } = useEffectivePermissions();
  const [orders, setOrders] = useState<QuickRentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());
  const canView = !isLoading && (!permissions || permissions.includes("rentals.view"));

  useEffect(() => {
    if (isLoading || !canView) return;
    let active = true;
    void (async () => {
      try {
        const data = await listQuickRentalOrders();
        if (active) setOrders(data);
      } catch {
        // Si no se puede consultar, el bloque simplemente no muestra datos.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoading, canView]);

  if (!canView) return null;

  const activeOrders = orders.filter((order) => order.status !== "returned");
  const pendingUnits = activeOrders.reduce(
    (total, order) => total + quickRentalOrderPendingQuantity(order),
    0,
  );
  const overdue = activeOrders.filter(
    (order) => new Date(order.dueAt).getTime() < now,
  );

  return (
    <section className="exec-summary-card" aria-label="Resumen de alquileres de equipos">
      <div className="exec-summary-heading">
        <div>
          <p>Custodia comercial</p>
          <h2>Alquileres de equipos</h2>
        </div>
        <Link href="/rentals">Abrir módulo →</Link>
      </div>

      <div className="exec-summary-stats">
        <div>
          <span>Documentos activos</span>
          <strong>{loading ? "—" : activeOrders.length}</strong>
        </div>
        <div>
          <span>Equipos fuera de bodega</span>
          <strong>{loading ? "—" : pendingUnits}</strong>
        </div>
        <div>
          <span>Devolución vencida</span>
          <strong>{loading ? "—" : overdue.length}</strong>
        </div>
      </div>

      {!loading && activeOrders.length > 0 ? (
        <ul className="exec-summary-list">
          {activeOrders.slice(0, 6).map((order) => {
            const late = new Date(order.dueAt).getTime() < now;
            const equipment = order.lines.map((line) => line.equipmentName).join(" · ");
            return (
              <li key={order.id}>
                <span>
                  <strong>{equipment || "Equipo sin nombre"}</strong>
                  <small>
                    {order.code} · {order.customerName} · {quickRentalOrderPendingQuantity(order)} unidad(es)
                  </small>
                </span>
                <span className="exec-summary-due" data-late={late}>
                  {late ? "Devolución vencida · " : "Devuelve "}
                  {new Date(order.dueAt).toLocaleDateString("es-CO")}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!loading && activeOrders.length === 0 ? (
        <p className="exec-summary-empty">No hay equipos alquilados en este momento.</p>
      ) : null}
    </section>
  );
}
