import { createBrowserClient } from "@supabase/ssr";
import { listApuQuoteLinks } from "@/modules/apu";
import { loadQuotesWorkspaceData } from "@/modules/quotes";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { loadAllPages } from "@/shared/supabase/load-all";
import { buildOperationalAlerts, type OperationalAlert } from "../domain/operational-alert";

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

/** Carga desde Supabase las alertas que alimentan la campana global del portal. */
export async function listOperationalAlerts(): Promise<OperationalAlert[]> {
  const supabase = client();
  if (!supabase) return [];
  const quoteData = await loadQuotesWorkspaceData();
  if (!quoteData) return [];
  const { companyId, quotes } = quoteData;

  const [linkedApus, stockResult, projectResult, movementResult, requisitionResult] = await Promise.all([
    listApuQuoteLinks(companyId),
    loadAllPages((from, to) =>
      supabase
        .from("inventory_stock")
        .select("id,quantity,minimum_quantity,inventory_items!inner(name,unit)")
        .eq("company_id", companyId)
        .order("id")
        .range(from, to),
    ),
    supabase.from("projects").select("id,code,material_budget").eq("company_id", companyId),
    loadAllPages((from, to) =>
      supabase
        .from("inventory_movements")
        .select("project_id,movement_type,operation_kind,quantity,unit_cost")
        .eq("company_id", companyId)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    ),
    supabase.from("inventory_requisitions").select("id,code,status,project:projects(name)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(30),
  ]);
  const queryError = stockResult.error ?? projectResult.error ?? movementResult.error ?? requisitionResult.error;
  if (queryError) throw queryError;

  return buildOperationalAlerts({
    quotes,
    linkedApuQuoteIds: linkedApus.map((apu) => apu.quoteId),
    products: (stockResult.data ?? []).flatMap((stock) => {
      const item = Array.isArray(stock.inventory_items) ? stock.inventory_items[0] : stock.inventory_items;
      if (!item) return [];
      return [{ id: stock.id, name: item.name, available: Number(stock.quantity), minimum: stock.minimum_quantity === null ? null : Number(stock.minimum_quantity), unit: item.unit ?? "unidad" }];
    }),
    projects: (projectResult.data ?? []).map((project) => ({ id: project.id, code: project.code, budget: Number(project.material_budget ?? 0) })),
    movements: movementResult.data.map((movement) => ({
      projectId: movement.project_id ?? undefined,
      type: movement.movement_type === "entry"
        ? (movement.operation_kind === "return" ? "return" : "entry")
        : movement.movement_type === "exit" || movement.movement_type === "transfer"
          ? movement.movement_type
          : "adjustment",
      totalCost: Number(movement.quantity) * Number(movement.unit_cost),
    })),
    requisitions: (requisitionResult.data ?? []).map((requisition) => {
      const project = Array.isArray(requisition.project) ? requisition.project[0] : requisition.project;
      return { id: requisition.id, code: requisition.code, status: requisition.status === "submitted" ? "pending" : requisition.status, projectName: project?.name ?? "Obra sin nombre" };
    }),
  });
}
