import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { Quote, QuoteHistoryEntry, QuoteStatus } from "../domain/quote";

type QuoteRow = {
  id: string; code: string; title: string; client: string; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null; email_origin: string | null;
  status: QuoteStatus; responsible: string; estimated_value: number | string | null; revision: number;
  cost_breakdown: Quote["costBreakdown"] | null; technical_visit: Quote["technicalVisit"] | null; technical_visits: Quote["technicalVisits"] | null;
  validity_days: number | null; sent_at: string | null; delivery_time_weeks: number | null;
  payment_terms: string | null; folder_url: string | null; received_at: string; deadline: string | null;
  next_action: string | null; project_id: string | null; notes: string | null; created_at: string; updated_at: string;
};

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

function toQuote(row: QuoteRow, history: QuoteHistoryEntry[]): Quote {
  return {
    id: row.id, code: row.code, title: row.title, client: row.client,
    contactName: row.contact_name ?? undefined, contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined, emailOrigin: row.email_origin ?? undefined,
    status: row.status, responsible: row.responsible, estimatedValue: row.estimated_value == null ? undefined : Number(row.estimated_value),
    revision: row.revision, costBreakdown: row.cost_breakdown ?? undefined,
    technicalVisit: row.technical_visit ?? undefined,
    technicalVisits: row.technical_visits ?? undefined,
    validityDays: row.validity_days ?? undefined, sentAt: row.sent_at ?? undefined,
    deliveryTimeWeeks: row.delivery_time_weeks ?? undefined, paymentTerms: row.payment_terms ?? undefined,
    folderUrl: row.folder_url ?? undefined, receivedAt: row.received_at, deadline: row.deadline ?? undefined,
    nextAction: row.next_action ?? undefined, projectId: row.project_id ?? undefined, notes: row.notes ?? undefined,
    history, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// RPC: convierte la cotización en obra de forma transaccional en Supabase.
export async function convertQuoteToProject(companyId: string, branchId: string | null, quoteId: string, payload: {
  projectType: string; projectName: string; client: string; location: string; materialBudget: number;
  startDate: string; estimatedEndDate: string; note: string;
}): Promise<{ projectId: string; code: string }> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("convert_quote_to_project", {
    p_company_id: companyId,
    p_branch_id: branchId,
    p_quote_id: quoteId,
    p_project_type: payload.projectType,
    p_project_name: payload.projectName,
    p_client: payload.client,
    p_location: payload.location,
    p_material_budget: payload.materialBudget,
    p_start_date: payload.startDate,
    p_estimated_end_date: payload.estimatedEndDate,
    p_note: payload.note,
  });
  if (error) throw error;
  return { projectId: data.projectId, code: data.code };
}

export async function loadQuotesWorkspaceData(): Promise<{ companyId: string; branchId: string | null; quotes: Quote[] } | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;
  const { data: memberships, error: membershipError } = await supabase.from("user_roles").select("company_id, branch_id").eq("user_id", auth.user.id).limit(1);
  if (membershipError) throw membershipError;
  const companyId = memberships?.[0]?.company_id;
  const branchId = memberships?.[0]?.branch_id ?? null;
  if (!companyId) throw new Error("Tu cuenta no está vinculada a una empresa y rol. Un administrador debe asignarte el acceso antes de guardar cotizaciones.");
  const [{ data: rows, error: quoteError }, { data: historyRows, error: historyError }, { data: projectRows, error: projectError }] = await Promise.all([
    supabase.from("quotes").select("*").eq("company_id", companyId).order("updated_at", { ascending: false }),
    supabase.from("quote_history").select("id,quote_id,from_status,to_status,changed_by,note,changed_at").eq("company_id", companyId).order("changed_at"),
    supabase.from("projects").select("id, code").eq("company_id", companyId),
  ]);
  if (quoteError) throw quoteError;
  if (historyError) throw historyError;
  if (projectError) throw projectError;
  const projectCodeById = new Map<string, string>();
  for (const project of projectRows ?? []) projectCodeById.set(project.id, project.code);
  const historyByQuote = new Map<string, QuoteHistoryEntry[]>();
  for (const row of historyRows ?? []) {
    const items = historyByQuote.get(row.quote_id) ?? [];
    items.push({ id: row.id, fromStatus: row.from_status as QuoteStatus | null, toStatus: row.to_status as QuoteStatus, changedBy: row.changed_by, note: row.note ?? undefined, changedAt: row.changed_at });
    historyByQuote.set(row.quote_id, items);
  }
  return {
    companyId,
    branchId,
    quotes: (rows ?? []).map((row) => {
      const quote = toQuote(row as QuoteRow, historyByQuote.get(row.id) ?? []);
      if (row.project_id && projectCodeById.has(row.project_id)) quote.projectCode = projectCodeById.get(row.project_id);
      return quote;
    }),
  };
}

/** Nombre del usuario autenticado; es el actor real de cualquier cambio. */
export async function currentActorName(): Promise<string> {
  const supabase = client();
  if (!supabase) return "Usuario";
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "Usuario";
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", data.user.id)
    .maybeSingle();
  return profile?.display_name || profile?.email || "Usuario";
}

/**
 * Guarda la cotización y su historial en una sola operación.
 * El `changed_by` de cada evento lo define Supabase a partir de la sesión,
 * por lo que ningún empleado puede registrar un responsable falso.
 */
export async function saveQuote(companyId: string, quote: Quote) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("save_quote_with_history", {
    p_company_id: companyId,
    p_quote: quote as unknown as Record<string, unknown>,
  });
  if (error) throw error;
}

