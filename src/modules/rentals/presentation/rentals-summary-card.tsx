"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { useEffectivePermissions } from "@/core/permissions/use-effective-permissions";

type RentalRow = {
  id: string;
  code: string;
  equipment_name: string;
  customer_name: string;
  due_at: string;
  status: string;
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/**
 * Resumen de alquileres dentro del Resumen.
 *
 * Antes el módulo de alquiler no aparecía en ninguna parte del dashboard, aunque
 * un equipo alquilado fuera material que está fuera de la bodega. Solo lo ve quien
 * tiene el permiso de consulta de alquileres.
 */
export function RentalsSummaryCard() {
  const { permissions, isLoading } = useEffectivePermissions();
  const [rows, setRows] = useState<RentalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const canView = !isLoading && (!permissions || permissions.includes("rentals.view"));

  useEffect(() => {
    if (isLoading || !canView) return;
    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
      setLoading(false);
      return;
    }
    const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data: membership } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", auth.user.id)
          .limit(1)
          .maybeSingle();
        if (!membership?.company_id) return;
        const { data } = await supabase
          .from("quick_rentals")
          .select("id, code, equipment_name, customer_name, due_at, status")
          .eq("company_id", membership.company_id)
          .order("due_at", { ascending: true })
          .limit(6);
        setRows(((data ?? []) as RentalRow[]) ?? []);
      } catch {
        // Si no se puede consultar, el bloque simplemente no se muestra.
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoading, canView]);

  if (!canView) return null;

  const activos = rows.filter((row) => row.status !== "returned");
  const hoy = new Date().toISOString().slice(0, 10);

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
          <span>Alquileres activos</span>
          <strong>{loading ? "—" : activos.length}</strong>
        </div>
        <div>
          <span>Equipos fuera de bodega</span>
          <strong>{loading ? "—" : activos.length}</strong>
        </div>
        <div>
          <span>Devolución vencida</span>
          <strong>{loading ? "—" : activos.filter((row) => row.due_at.slice(0, 10) < hoy).length}</strong>
        </div>
      </div>

      {!loading && activos.length > 0 ? (
        <ul className="exec-summary-list">
          {activos.map((row) => {
            const atrasada = row.due_at.slice(0, 10) < hoy;
            return (
              <li key={row.id}>
                <span>
                  <strong>{row.equipment_name}</strong>
                  <small>{row.code} · {row.customer_name}</small>
                </span>
                <span className="exec-summary-due" data-late={atrasada}>
                  {atrasada ? "Devolución vencida · " : "Devuelve "}
                  {new Date(row.due_at).toLocaleDateString("es-CO")}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!loading && activos.length === 0 ? (
        <p className="exec-summary-empty">No hay equipos alquilados en este momento.</p>
      ) : null}
    </section>
  );
}