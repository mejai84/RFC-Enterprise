"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

type Metrics = { period: { from: string; to: string; timezone: string }; summary: { following?: number; approved_value?: number; active_projects?: number; conversion?: number | null; operational_alerts?: number }; quotes_monthly: Array<{ month: string; received: number; sent: number; approved: number }>; quote_statuses: Array<{ status: string; count: number; value: number }>; project_statuses: Array<{ status: string; count: number }>; critical_inventory: Array<{ name: string; available: number; minimum: number; deficit: number }>; attendance: Array<{ date: string; employees: number }> };
const palette = ["#0b7a47", "#c49024", "#2f6fb2", "#7b4bb7", "#b45309", "#64756d"];
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const dateLabel = new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit", timeZone: "America/Bogota" });
const statusLabel: Record<string, string> = { received: "Recibida", in_review: "En revisión", estimating: "En estudio", sent: "Enviada", awaiting_response: "En espera", revision_requested: "En ajuste", confirmed: "Aprobada", in_execution: "En ejecución", work_completed: "Terminada", billing_pending: "Por facturar", closed: "Cerrada", lost: "Perdida", active: "Activa", pending: "Pendiente", completed: "Terminada", on_hold: "Suspendida" };

function client() { return isSupabaseConfigured && supabaseUrl && supabasePublishableKey ? createBrowserClient(supabaseUrl, supabasePublishableKey) : null; }
function Empty({ children }: { children: string }) { return <p className="executive-chart-empty">{children}</p>; }

export function ExecutiveAnalytics() {
  const [period, setPeriod] = useState<"90" | "180" | "365">("180");
  const [data, setData] = useState<Metrics | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const load = useCallback(async () => {
    const db = client(); if (!db) { setState("empty"); return; }
    setState("loading");
    const to = new Date(); const from = new Date(to); from.setDate(to.getDate() - Number(period));
    const { data: result, error } = await db.rpc("get_executive_dashboard_metrics", { p_from: from.toISOString().slice(0, 10), p_to: to.toISOString().slice(0, 10), p_project_id: null, p_client: null });
    if (error) { setState("error"); return; }
    const metrics = result as Metrics | null; setData(metrics); setState(metrics && Object.values(metrics.summary ?? {}).length ? "ready" : "empty");
  }, [period]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const monthly = useMemo(() => (data?.quotes_monthly ?? []).map((point) => ({ ...point, label: dateLabel.format(new Date(`${point.month}T12:00:00`)) })), [data]);
  const summary = data?.summary ?? {};
  return <section className="executive-analytics" aria-labelledby="executive-analytics-title">
    <header className="executive-analytics-header"><div><p>Analítica empresarial</p><h2 id="executive-analytics-title">Centro de control</h2><small>{data ? `${data.period.from} — ${data.period.to} · ${data.period.timezone}` : "Consultando datos autorizados"}</small></div><label>Período<select value={period} onChange={(event) => setPeriod(event.target.value as "90" | "180" | "365")}><option value="90">Últimos 90 días</option><option value="180">Últimos 6 meses</option><option value="365">Últimos 12 meses</option></select></label></header>
    {state === "error" ? <div className="executive-analytics-state" role="alert">No fue posible consultar los indicadores. <button onClick={() => void load()} type="button">Reintentar</button></div> : null}
    {state === "empty" ? <div className="executive-analytics-state">Sin datos para el período y los permisos actuales.</div> : null}
    <div className="executive-kpis" aria-busy={state === "loading"}>
      <Link href="/quotes"><small>Cotizaciones en seguimiento</small><strong>{summary.following ?? "—"}</strong><span>Ver cotizaciones</span></Link><Link href="/quotes"><small>Valor aprobado</small><strong>{summary.approved_value === undefined ? "—" : money.format(summary.approved_value)}</strong><span>No es ingreso facturado</span></Link><Link href="/projects"><small>Proyectos activos</small><strong>{summary.active_projects ?? "—"}</strong><span>Ver obras</span></Link><Link href="/quotes"><small>Conversión comercial</small><strong>{summary.conversion == null ? "Sin datos" : `${summary.conversion}%`}</strong><span>Solo decisiones tomadas</span></Link><Link href="/inventory?tab=low-stock"><small>Alertas inventario</small><strong>{summary.operational_alerts ?? "—"}</strong><span>Ver existencias críticas</span></Link>
    </div>
    <div className="executive-chart-grid">
      <article className="executive-chart executive-chart-wide"><header><div><h3>Cotizaciones recibidas y aprobadas</h3><p>Por mes, según fecha real del evento.</p></div><Link href="/quotes">Abrir módulo</Link></header>{monthly.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={monthly}><XAxis dataKey="label"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="received" name="Recibidas" fill="#0b7a47" radius={[4,4,0,0]}/><Bar dataKey="sent" name="Enviadas" fill="#c49024" radius={[4,4,0,0]}/><Bar dataKey="approved" name="Aprobadas" fill="#2f6fb2" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer> : <Empty>No hay cotizaciones para este período.</Empty>}</article>
      <article className="executive-chart"><header><div><h3>Estados de cotizaciones</h3><p>Distribución actual.</p></div><Link href="/quotes">Abrir</Link></header>{data?.quote_statuses.length ? <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data.quote_statuses} dataKey="count" nameKey="status" innerRadius={58} outerRadius={88}>{data.quote_statuses.map((item,index)=><Cell fill={palette[index % palette.length]} key={item.status}/>)}</Pie><Tooltip formatter={(value) => [value, "Cotizaciones"]} labelFormatter={(label)=>statusLabel[String(label)] ?? String(label)}/><Legend formatter={(value)=>statusLabel[String(value)] ?? String(value)}/></PieChart></ResponsiveContainer> : <Empty>Sin datos de cotizaciones.</Empty>}</article>
      <article className="executive-chart"><header><div><h3>Estado de proyectos</h3><p>Obras por estado.</p></div><Link href="/projects">Abrir</Link></header>{data?.project_statuses.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={data.project_statuses.map((item)=>({...item,label:statusLabel[item.status]??item.status}))} layout="vertical"><XAxis type="number" allowDecimals={false}/><YAxis dataKey="label" type="category" width={88}/><Tooltip/><Bar dataKey="count" name="Proyectos" fill="#0b7a47" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin proyectos visibles.</Empty>}</article>
      <article className="executive-chart"><header><div><h3>Inventario crítico</h3><p>Faltante frente al mínimo.</p></div><Link href="/inventory?tab=low-stock">Abrir</Link></header>{data?.critical_inventory.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={data.critical_inventory} layout="vertical"><XAxis type="number"/><YAxis dataKey="name" type="category" width={100}/><Tooltip/><Bar dataKey="deficit" name="Faltante" fill="#b45309" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin existencias bajo mínimo.</Empty>}</article>
      <article className="executive-chart"><header><div><h3>Registro de jornadas</h3><p>Empleados con jornada por día.</p></div><Link href="/attendance">Abrir</Link></header>{data?.attendance.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={data.attendance}><XAxis dataKey="date" tickFormatter={(value)=>String(value).slice(5)}/><YAxis allowDecimals={false}/><Tooltip/><Line type="monotone" dataKey="employees" name="Empleados" stroke="#0b7a47" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer> : <Empty>Sin jornadas para el período.</Empty>}</article>
    </div><p className="executive-analytics-note">Costo real, avance y rentabilidad se activarán cuando existan fuentes verificables para esas métricas.</p></section>;
}