"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { loadAllPages } from "@/shared/supabase/load-all";

type Employee = { id: string; name: string; title?: string };
type Stock = { id: string; name: string; unit: string; available: number };
type DraftLine = { stockId: string; quantity: string };
type Delivery = { id: string; reference: string; type: string; employee: string; deliveredAt: string; lines: string };

const deliveryLabels: Record<string, string> = {
  initial: "Entrega inicial",
  replacement: "Reposici\u00f3n",
  return: "Devoluci\u00f3n",
};
const emptyLine = (): DraftLine => ({ stockId: "", quantity: "1" });

export function DotacionDeliveryPanel({ companyId, projectId, employees }: { companyId: string; projectId: string; employees: Employee[] }) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [deliveryType, setDeliveryType] = useState<"initial" | "replacement" | "return">("initial");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabaseUrl || !supabasePublishableKey) return;
    const db = createBrowserClient(supabaseUrl, supabasePublishableKey);
    const [stockResult, { data: deliveryRows, error: deliveryError }] = await Promise.all([
      loadAllPages((from, to) =>
        db
          .from("inventory_stock")
          .select("id,quantity,inventory_items!inventory_stock_item_id_fkey!inner(name,unit)")
          .eq("company_id", companyId)
          .eq("inventory_group", "dotacion")
          .order("updated_at", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      db.from("employee_dotacion_deliveries").select("id,reference,delivery_type,delivered_at,employee:employees(full_name),lines:employee_dotacion_delivery_lines(item_name_snapshot,quantity)").eq("company_id", companyId).eq("project_id", projectId).order("delivered_at", { ascending: false }).limit(12),
    ]);
    if (stockResult.error || deliveryError) {
      setError(stockResult.error?.message ?? deliveryError?.message ?? "No fue posible cargar la dotaci\u00f3n.");
      return;
    }
    setStocks(stockResult.data.map((row) => {
      const item = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
      return { id: row.id, name: item?.name ?? "Art\u00edculo", unit: item?.unit ?? "unidad", available: Number(row.quantity) };
    }));
    setDeliveries((deliveryRows ?? []).map((row) => {
      const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee;
      const detailLines = Array.isArray(row.lines) ? row.lines : [];
      return { id: row.id, reference: row.reference, type: row.delivery_type, employee: employee?.full_name ?? "Trabajador", deliveredAt: new Date(row.delivered_at).toLocaleDateString("es-CO"), lines: detailLines.map((line) => `${line.item_name_snapshot} \u00b7 ${line.quantity}`).join(", ") };
    }));
  }, [companyId, projectId]);

  useEffect(() => { void load(); }, [load]);

  const canSubmit = useMemo(() => Boolean(employeeId) && lines.length > 0 && lines.every((line) => Boolean(line.stockId) && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0), [employeeId, lines]);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (!canSubmit) { setError("Selecciona trabajador, art\u00edculos y cantidades mayores que cero."); return; }
    const duplicateStock = lines.some((line, index) => lines.findIndex((candidate) => candidate.stockId === line.stockId) !== index);
    if (duplicateStock) { setError("Agrega cada art\u00edculo una sola vez y suma su cantidad en la misma l\u00ednea."); return; }
    setSaving(true);
    const db = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
    const { error: saveError } = await db.rpc("issue_employee_dotacion", { p_project_id: projectId, p_employee_id: employeeId, p_delivery_type: deliveryType, p_notes: notes.trim(), p_lines: lines.map((line) => ({ stock_id: line.stockId, quantity: Number(line.quantity) })) });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setNotice("Entrega registrada y existencias actualizadas."); setLines([emptyLine()]); setNotes(""); await load();
  }

  return (
    <section className="materials-history-card" aria-labelledby="dotacion-entrega-title">
      <div>
        <h3 id="dotacion-entrega-title">Entrega de dotaci\u00f3n</h3>
        <p className="panel-intro">Registra lo realmente entregado a cada trabajador. Un comprobante puede incluir varios art\u00edculos y guarda obra, fecha, responsable y movimiento de inventario.</p>
      </div>
      {error ? <p className="settings-notice" role="alert">{error}</p> : null}
      {notice ? <p className="settings-notice" role="status">{notice}</p> : null}
      {!employees.length ? <p className="empty-state">Primero asigna al trabajador a esta obra para poder entregarle dotaci\u00f3n.</p> : (
        <form onSubmit={submit}>
          <div className="form-row-2">
            <div className="form-group"><label htmlFor="dotacion-employee">Trabajador</label><select id="dotacion-employee" required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Selecciona un trabajador</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.title ? ` \u00b7 ${employee.title}` : ""}</option>)}</select></div>
            <div className="form-group"><label htmlFor="dotacion-type">Tipo de movimiento</label><select id="dotacion-type" value={deliveryType} onChange={(event) => setDeliveryType(event.target.value as typeof deliveryType)}><option value="initial">Entrega inicial</option><option value="replacement">Reposici\u00f3n</option><option value="return">Devoluci\u00f3n</option></select></div>
          </div>
          <div className="materials-history-card">
            <h4>Art\u00edculos entregados</h4>
            {lines.map((line, index) => <div className="form-row-2" key={index}>
              <div className="form-group"><label htmlFor={`dotacion-stock-${index}`}>{index === 0 ? "Art\u00edculo de dotaci\u00f3n" : `Art\u00edculo ${index + 1}`}</label><select id={`dotacion-stock-${index}`} required value={line.stockId} onChange={(event) => updateLine(index, { stockId: event.target.value })}><option value="">Selecciona un art\u00edculo</option>{stocks.map((stock) => <option key={stock.id} value={stock.id} disabled={deliveryType !== "return" && stock.available <= 0}>{stock.name} \u00b7 Disponibles: {stock.available} {stock.unit}</option>)}</select></div>
              <div className="form-group"><label htmlFor={`dotacion-quantity-${index}`}>Cantidad</label><div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}><input id={`dotacion-quantity-${index}`} min="0.01" required step="0.01" type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />{lines.length > 1 ? <button className="btn-cancel" type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Quitar</button> : null}</div></div>
            </div>)}
            <button className="inventory-action btn-secondary-action" type="button" onClick={() => setLines((current) => [...current, emptyLine()])}>Agregar art\u00edculo</button>
          </div>
          <div className="form-row-2">
            <div className="form-group"><label htmlFor="dotacion-notes">Observaci\u00f3n</label><input id="dotacion-notes" maxLength={300} placeholder="Ej. uniforme de reemplazo por desgaste" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            <div className="form-group"><label>&nbsp;</label><button className="btn-submit" disabled={saving || !canSubmit} type="submit">{saving ? "Registrando..." : "Registrar entrega"}</button></div>
          </div>
        </form>
      )}
      <div className="project-team-list" aria-live="polite">{deliveries.length ? deliveries.map((delivery) => <div className="employee-team-option" key={delivery.id}><span><strong>{delivery.reference} \u00b7 {deliveryLabels[delivery.type] ?? delivery.type}</strong><small>{delivery.employee} \u00b7 {delivery.deliveredAt}{delivery.lines ? ` \u00b7 ${delivery.lines}` : ""}</small></span></div>) : <p className="empty-state">A\u00fan no hay entregas de dotaci\u00f3n registradas para esta obra.</p>}</div>
    </section>
  );
}