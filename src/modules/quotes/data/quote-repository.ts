import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { Quote, QuoteHistoryEntry, QuoteStatus } from "../domain/quote";

type QuoteRow = {
  id: string; code: string; title: string; client: string; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null; email_origin: string | null;
  status: QuoteStatus; responsible: string; estimated_value: number | string | null; revision: number;
  cost_breakdown: Quote["costBreakdown"] | null; technical_visit: Quote["technicalVisit"] | null;
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
    revision: row.revision, costBreakdown: row.cost_breakdown ?? undefined, technicalVisit: row.technical_visit ?? undefined,
    validityDays: row.validity_days ?? undefined, sentAt: row.sent_at ?? undefined,
    deliveryTimeWeeks: row.delivery_time_weeks ?? undefined, paymentTerms: row.payment_terms ?? undefined,
    folderUrl: row.folder_url ?? undefined, receivedAt: row.received_at, deadline: row.deadline ?? undefined,
    nextAction: row.next_action ?? undefined, projectId: row.project_id ?? undefined, notes: row.notes ?? undefined,
    history, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function loadQuotesWorkspaceData(): Promise<{ companyId: string; quotes: Quote[] } | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;
  const { data: memberships, error: membershipError } = await supabase.from("user_roles").select("company_id").eq("user_id", auth.user.id).limit(1);
  if (membershipError) throw membershipError;
  const companyId = memberships?.[0]?.company_id;
  if (!companyId) throw new Error("Tu cuenta no está vinculada a una empresa y rol. Un administrador debe asignarte el acceso antes de guardar cotizaciones.");
  const [{ data: rows, error: quoteError }, { data: historyRows, error: historyError }] = await Promise.all([
    supabase.from("quotes").select("*").eq("company_id", companyId).order("updated_at", { ascending: false }),
    supabase.from("quote_history").select("id,quote_id,from_status,to_status,changed_by,note,changed_at").eq("company_id", companyId).order("changed_at"),
  ]);
  if (quoteError) throw quoteError;
  if (historyError) throw historyError;
  const historyByQuote = new Map<string, QuoteHistoryEntry[]>();
  for (const row of historyRows ?? []) {
    const items = historyByQuote.get(row.quote_id) ?? [];
    items.push({ id: row.id, fromStatus: row.from_status as QuoteStatus | null, toStatus: row.to_status as QuoteStatus, changedBy: row.changed_by, note: row.note ?? undefined, changedAt: row.changed_at });
    historyByQuote.set(row.quote_id, items);
  }
  return { companyId, quotes: (rows ?? []).map((row) => toQuote(row as QuoteRow, historyByQuote.get(row.id) ?? [])) };
}

export async function saveQuote(companyId: string, quote: Quote) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.from("quotes").upsert({
    id: quote.id, company_id: companyId, code: quote.code, title: quote.title, client: quote.client,
    contact_name: quote.contactName || null, contact_email: quote.contactEmail || null, contact_phone: quote.contactPhone || null,
    email_origin: quote.emailOrigin || null, status: quote.status, responsible: quote.responsible,
    estimated_value: quote.estimatedValue ?? null, revision: quote.revision, cost_breakdown: quote.costBreakdown ?? null,
    technical_visit: quote.technicalVisit ?? null, validity_days: quote.validityDays ?? null, sent_at: quote.sentAt ?? null,
    delivery_time_weeks: quote.deliveryTimeWeeks ?? null, payment_terms: quote.paymentTerms ?? null,
    folder_url: quote.folderUrl ?? null, received_at: quote.receivedAt, deadline: quote.deadline ?? null,
    next_action: quote.nextAction ?? null, project_id: quote.projectId ?? null, notes: quote.notes ?? null,
  }, { onConflict: "id" });
  if (error) throw error;
  const { data: existing, error: existingError } = await supabase.from("quote_history").select("id").eq("quote_id", quote.id);
  if (existingError) throw existingError;
  const known = new Set((existing ?? []).map((row) => row.id));
  const missing = quote.history.filter((entry) => !known.has(entry.id));
  if (!missing.length) return;
  const { error: historyError } = await supabase.from("quote_history").insert(missing.map((entry) => ({
    id: entry.id, quote_id: quote.id, company_id: companyId, from_status: entry.fromStatus,
    to_status: entry.toStatus, changed_by: entry.changedBy, note: entry.note ?? null, changed_at: entry.changedAt,
  })));
  if (historyError) throw historyError;
}
