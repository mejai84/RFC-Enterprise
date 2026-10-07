"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/app/dashboard-shell";
import {
  AttendanceConsultation,
  WorkCheckInWorkspace,
  loadWorkCheckInWorkspaceData,
  type WorkCheckInWorkspaceData,
} from "@/modules/attendance";

type Tab = "declaration" | "consultation";

export default function AttendancePage() {
  const [data, setData] = useState<WorkCheckInWorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("declaration");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await loadWorkCheckInWorkspaceData();
        if (!active) return;
        setData(next);
        // La consulta gerencial solo existe para quienes pueden revisar al equipo.
        setTab(next?.canReview ? "consultation" : "declaration");
      } catch {
        // La pantalla de declaración muestra el motivo del error.
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardShell>
      <main className="dashboard-content attendance-page" id="main-content">
        <header className="attendance-hero">
          <div>
            <p className="attendance-eyebrow">Declaración de jornada</p>
            <h1>Registro de jornada</h1>
            <p>
              Declara tu frente de trabajo y actividad. La ubicación es opcional y solo se lee si tú
              la activas; no rastreamos a nadie en segundo plano.
            </p>
          </div>
          {data?.canReview ? (
            <nav aria-label="Secciones del registro de jornada" className="attendance-tabs">
              <button
                aria-current={tab === "consultation" ? "page" : undefined}
                className="attendance-tab"
                onClick={() => setTab("consultation")}
                type="button"
              >
                Consulta de jornada
              </button>
              <button
                aria-current={tab === "declaration" ? "page" : undefined}
                className="attendance-tab"
                onClick={() => setTab("declaration")}
                type="button"
              >
                Mi declaración
              </button>
            </nav>
          ) : null}
        </header>

        {isLoading ? <p className="attendance-helper">Preparando el registro de jornada…</p> : null}
        {!isLoading && tab === "declaration" ? <WorkCheckInWorkspace /> : null}
        {!isLoading && tab === "consultation" && data?.canReview ? <AttendanceConsultation /> : null}
      </main>
    </DashboardShell>
  );
}