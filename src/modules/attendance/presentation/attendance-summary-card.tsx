"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { useEffectivePermissions } from "@/core/permissions/use-effective-permissions";
import { loadCurrentWorkday, loadMyWorkdaySegments } from "../data/work-check-in-repository";
import type { CurrentWorkday, WorkdaySegment } from "../domain/work-check-in";

const segmentLabels: Record<string, string> = {
  work: "Actividad de trabajo",
  travel: "Desplazamiento",
  break: "Pausa",
};

/**
 * Mi jornada en el Resumen.
 *
 * Para quien no tiene acceso a los indicadores financieros, el Resumen mostraba
 * antes cifras de la empresa que no le corresponden y nada de lo suyo. Esta
 * tarjeta responde lo contrario: quédeclare hoy y en qué está.
 */
export function AttendanceSummaryCard() {
  const { permissions, isLoading } = useEffectivePermissions();
  const [workday, setWorkday] = useState<CurrentWorkday | null>(null);
  const [segments, setSegments] = useState<WorkdaySegment[]>([]);
  const [loading, setLoading] = useState(true);
  const canView = !isLoading && (!permissions || permissions.includes("attendance.self.record"));

  useEffect(() => {
    if (isLoading || !canView) return;
    void (async () => {
      try {
        const [current, mine] = await Promise.all([
          loadCurrentWorkday(),
          loadMyWorkdaySegments().catch(() => []),
        ]);
        setWorkday(current);
        setSegments(mine);
      } catch {
        // Sin datos no se muestra el bloque; no es un error para el usuario.
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoading, canView]);

  if (!canView) return null;

  const abierta = workday?.status === "open";
  const tramo = workday?.currentSegment;

  return (
    <section className="exec-summary-card" aria-label="Mi jornada de hoy">
      <div className="exec-summary-heading">
        <div>
          <p>Mi trabajo</p>
          <h2>Mi jornada de hoy</h2>
        </div>
        <Link href="/attendance">Abrir registro →</Link>
      </div>

      <div className="exec-summary-stats">
        <div>
          <span>Estado</span>
          <strong>
            {loading ? "—" : workday ? (abierta ? "Abierta" : "Cerrada") : "Sin iniciar"}
          </strong>
        </div>
        <div>
          <span>Actividades registradas</span>
          <strong>{loading ? "—" : segments.length}</strong>
        </div>
      </div>

      {tramo ? (
        <p className="exec-summary-current">
          <strong>{segmentLabels[tramo.type] ?? tramo.type}</strong>
          <span>{tramo.activityDescription}</span>
          <small>{tramo.siteName}</small>
        </p>
      ) : null}

      {!loading && !abierta ? (
        <p className="exec-summary-empty">
          Registra tu entrada al llegar. Puedes ir agregando actividades durante el día.
        </p>
      ) : null}
    </section>
  );
}