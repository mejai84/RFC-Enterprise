"use client";

import { useEffect, useState } from "react";
import { getLaborPositionCatalog, type LaborPosition } from "@/modules/apu";

const formatCOP = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function LaborWorkspace() {
  const [positions, setPositions] = useState<LaborPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    getLaborPositionCatalog()
      .then((catalog) => {
        if (!active) return;
        setPositions(catalog.positions);
        if (catalog.warning) setError(catalog.warning);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError("Error al cargar el catálogo de mano de obra.");
        setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = positions.filter((p) => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.code.toLowerCase().includes(query.toLowerCase()) ||
    p.validTo.includes(query)
  );

  return (
    <main className="dashboard-content" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Módulo de Presupuestos (APU) · Configuración</p>
          <h1>Catálogo de Tarifas Salariales</h1>
        </div>
        <div className="report-controls">
           <button className="emp-btn emp-btn--primary" onClick={() => window.alert("Creación en desarrollo. Por ahora, los datos provienen de Supabase directamente.")}>+ Nueva Tarifa</button>
        </div>
      </section>

      {error && (
        <div style={{ background: "#fef2f2", color: "#991b1b", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <input 
          type="search" 
          placeholder="Buscar por cargo, código o año (ej. 2026)..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: "10px", width: "100%", maxWidth: "400px", borderRadius: "8px", border: "1px solid var(--line)" }}
        />
      </div>

      <div className="dashboard-panel" style={{ overflowX: "auto" }}>
        <table className="inventory-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ padding: "12px", borderBottom: "2px solid var(--line)" }}>Código</th>
              <th style={{ padding: "12px", borderBottom: "2px solid var(--line)" }}>Cargo / Especialidad</th>
              <th style={{ padding: "12px", borderBottom: "2px solid var(--line)" }}>Nivel</th>
              <th style={{ padding: "12px", borderBottom: "2px solid var(--line)" }}>Básico Día</th>
              <th style={{ padding: "12px", borderBottom: "2px solid var(--line)" }}>Auxilios</th>
              <th style={{ padding: "12px", borderBottom: "2px solid var(--line)" }}>Total Diario</th>
              <th style={{ padding: "12px", borderBottom: "2px solid var(--line)" }}>Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ padding: "20px", textAlign: "center" }}>Cargando tarifas...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "20px", textAlign: "center" }}>No se encontraron cargos.</td></tr>
            ) : (
              filtered.map((pos) => (
                <tr key={pos.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "12px" }}><strong>{pos.code}</strong></td>
                  <td style={{ padding: "12px" }}>
                    <div>{pos.name}</div>
                    <small style={{ color: "var(--muted)" }}>{pos.specialtyLabel} · {pos.activityType}</small>
                  </td>
                  <td style={{ padding: "12px" }}>{pos.level}</td>
                  <td style={{ padding: "12px" }}>{formatCOP(pos.dailyBasicSalary)}</td>
                  <td style={{ padding: "12px" }}>
                    <small style={{ display: "block" }}>Transp: {formatCOP(pos.transportAllowance)}</small>
                    <small style={{ display: "block" }}>Alim: {formatCOP(pos.foodAllowance)}</small>
                    {pos.nonSalaryAllowance > 0 && <small style={{ display: "block" }}>Otro: {formatCOP(pos.nonSalaryAllowance)}</small>}
                  </td>
                  <td style={{ padding: "12px", fontWeight: "bold", color: "var(--brand-dark)" }}>{formatCOP(pos.totalDailyRate)}</td>
                  <td style={{ padding: "12px" }}><span style={{ background: "var(--brand-soft)", padding: "4px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", color: "var(--brand-dark)" }}>{pos.validTo.substring(0, 4)}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
