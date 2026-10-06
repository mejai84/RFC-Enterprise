import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { apuTotal, lineTotal, type Apu, type ApuLine } from "../domain/apu";

export type ApuProject = { id: string; code: string; name: string };
export type ProjectBoqItem = { id: string; projectId: string; apuAnalysisId: string; apuVersionId: string; code: string; description: string; unit: string; contractQuantity: number; budgetTotal: number; status: string };
export type ProjectBoqCost = { id: string; boqItemId: string; costType: "committed" | "actual"; amount: number; reference?: string; occurredAt: string };
export type ApuWorkspaceData = { companyId: string; apus: Apu[]; projects: ApuProject[]; boqItems: ProjectBoqItem[]; boqCosts: ProjectBoqCost[] };

const uuid = (value?: string) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
const num = (value: unknown) => Number(value || 0);

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

export async function loadApuWorkspaceData(): Promise<ApuWorkspaceData | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;
  const { data: memberships } = await supabase.from("user_roles").select("company_id").eq("user_id", auth.user.id).limit(1);
  const companyId = memberships?.[0]?.company_id;
  if (!companyId) throw new Error("Tu cuenta no está vinculada a una empresa y rol. Un administrador debe asignarte el acceso antes de guardar APUs.");

  const [{ data: analysisRows, error: analysisError }, { data: projects }, { data: boqRows }] = await Promise.all([
    supabase.from("apu_analyses").select("id, code, name, unit, work_quantity, quote_id, quote_code, project_id, current_version, status, created_at, updated_at").eq("company_id", companyId).neq("status", "archived").order("updated_at", { ascending: false }),
    supabase.from("projects").select("id, code, name").eq("company_id", companyId).in("status", ["pending", "active", "on_hold"]).order("name"),
    supabase.from("project_boq_items").select("id, project_id, apu_analysis_id, apu_version_id, code, description, unit, contract_quantity, budget_total, status").eq("company_id", companyId).neq("status", "cancelled"),
  ]);
  if (analysisError) throw analysisError;
  const analysisIds = (analysisRows ?? []).map((row) => row.id);
  const { data: versionRows } = analysisIds.length ? await supabase.from("apu_versions").select("id, apu_analysis_id, version_number").in("apu_analysis_id", analysisIds).order("version_number", { ascending: false }) : { data: [] };
  const currentVersionByAnalysis = new Map<string, { id: string; version_number: number }>();
  for (const row of versionRows ?? []) if (!currentVersionByAnalysis.has(row.apu_analysis_id)) currentVersionByAnalysis.set(row.apu_analysis_id, row);
  const versionIds = Array.from(currentVersionByAnalysis.values()).map((row) => row.id);
  const [{ data: lineRows }, { data: costRows }] = await Promise.all([
    versionIds.length ? supabase.from("apu_version_lines").select("id, apu_version_id, category, name, quantity, yield_per_day, daily_rate, inventory_product_id, labor_position_id, labor_code, labor_level, labor_activity_type, transport_item_id, transport_code, unit").in("apu_version_id", versionIds) : Promise.resolve({ data: [] }),
    (boqRows ?? []).length ? supabase.from("project_boq_cost_entries").select("id, boq_item_id, cost_type, amount, reference, occurred_at").in("boq_item_id", (boqRows ?? []).map((row) => row.id)) : Promise.resolve({ data: [] }),
  ]);
  const linesByVersion = new Map<string, ApuLine[]>();
  for (const row of lineRows ?? []) {
    const lines = linesByVersion.get(row.apu_version_id) ?? [];
    lines.push({ id: row.id, category: row.category as ApuLine["category"], name: row.name, quantity: num(row.quantity), yieldPerDay: num(row.yield_per_day), dailyRate: num(row.daily_rate), inventoryProductId: row.inventory_product_id || undefined, laborPositionId: row.labor_position_id || undefined, laborCode: row.labor_code || undefined, laborLevel: row.labor_level || undefined, laborActivityType: row.labor_activity_type || undefined, transportItemId: row.transport_item_id || undefined, transportCode: row.transport_code || undefined, unit: row.unit || undefined });
    linesByVersion.set(row.apu_version_id, lines);
  }
  return {
    companyId,
    apus: (analysisRows ?? []).map((row) => {
      const version = currentVersionByAnalysis.get(row.id);
      return { id: row.id, code: row.code, name: row.name, unit: row.unit, workQuantity: num(row.work_quantity), lines: version ? linesByVersion.get(version.id) ?? [] : [], quoteId: row.quote_id || undefined, quoteCode: row.quote_code || undefined, projectId: row.project_id || undefined, revision: version?.version_number ?? row.current_version, versionId: version?.id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } as Apu;
    }),
    projects: (projects ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name })),
    boqItems: (boqRows ?? []).map((row) => ({ id: row.id, projectId: row.project_id, apuAnalysisId: row.apu_analysis_id, apuVersionId: row.apu_version_id, code: row.code, description: row.description, unit: row.unit, contractQuantity: num(row.contract_quantity), budgetTotal: num(row.budget_total), status: row.status })),
    boqCosts: (costRows ?? []).map((row) => ({ id: row.id, boqItemId: row.boq_item_id, costType: row.cost_type, amount: num(row.amount), reference: row.reference || undefined, occurredAt: row.occurred_at })),
  };
}

export async function saveApuAnalysis(companyId: string, apu: Apu) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const directCost = apuTotal(apu);
  const { error: analysisError } = await supabase.from("apu_analyses").upsert({ id: apu.id, company_id: companyId, project_id: uuid(apu.projectId) ? apu.projectId : null, quote_id: uuid(apu.quoteId) ? apu.quoteId : null, quote_code: apu.quoteCode || null, code: apu.code, name: apu.name, unit: apu.unit, work_quantity: apu.workQuantity, status: apu.status === "approved" ? "approved" : "draft" }, { onConflict: "id" });
  if (analysisError) throw analysisError;
  const { data: latest } = await supabase.from("apu_versions").select("version_number").eq("apu_analysis_id", apu.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const versionNumber = (latest?.version_number ?? 0) + 1;
  const { data: version, error: versionError } = await supabase.from("apu_versions").insert({ apu_analysis_id: apu.id, company_id: companyId, version_number: versionNumber, status: apu.status === "approved" ? "approved" : "draft", direct_cost: directCost, total_cost: directCost, change_note: `Guardado desde APU ${apu.code}` }).select("id").single();
  if (versionError || !version) throw versionError || new Error("No fue posible crear la versión del APU.");
  if (apu.lines.length) {
    const { error: linesError } = await supabase.from("apu_version_lines").insert(apu.lines.map((line) => ({ apu_version_id: version.id, company_id: companyId, category: line.category, name: line.name, quantity: line.quantity, yield_per_day: line.yieldPerDay, daily_rate: line.dailyRate, line_total: lineTotal(line), inventory_product_id: uuid(line.inventoryProductId) ? line.inventoryProductId : null, labor_position_id: uuid(line.laborPositionId) ? line.laborPositionId : null, labor_code: line.laborCode || null, labor_level: line.laborLevel || null, labor_activity_type: line.laborActivityType || null, transport_item_id: uuid(line.transportItemId) ? line.transportItemId : null, transport_code: line.transportCode || null, unit: line.unit || null })));
    if (linesError) throw linesError;
  }
  const { error: updateError } = await supabase.from("apu_analyses").update({ current_version: versionNumber, status: apu.status === "approved" ? "approved" : "draft" }).eq("id", apu.id);
  if (updateError) throw updateError;
  return { versionId: version.id, revision: versionNumber };
}

export async function archiveApuAnalysis(apuId: string) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.from("apu_analyses").update({ status: "archived" }).eq("id", apuId);
  if (error) throw error;
}

export async function publishApuToBoq(companyId: string, apu: Apu, projectId: string) {
  const supabase = client();
  if (!supabase || !apu.versionId) throw new Error("Guarda el APU antes de enviarlo al presupuesto.");
  const budgetUnitCost = apuTotal(apu) / apu.workQuantity;
  const { error } = await supabase.from("project_boq_items").upsert({ company_id: companyId, project_id: projectId, quote_id: uuid(apu.quoteId) ? apu.quoteId : null, apu_analysis_id: apu.id, apu_version_id: apu.versionId, code: apu.code, description: apu.name, unit: apu.unit, contract_quantity: apu.workQuantity, budget_unit_cost: budgetUnitCost, budget_total: apuTotal(apu), status: "active" }, { onConflict: "project_id,apu_analysis_id" });
  if (error) throw error;
}

export async function registerBoqCost(companyId: string, boqItemId: string, costType: ProjectBoqCost["costType"], amount: number, reference: string) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.from("project_boq_cost_entries").insert({ company_id: companyId, boq_item_id: boqItemId, cost_type: costType, amount, reference: reference || null });
  if (error) throw error;
}
