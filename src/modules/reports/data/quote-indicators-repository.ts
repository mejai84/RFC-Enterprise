import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { QuoteIndicatorHistoryEntry, QuoteIndicatorQuote, QuoteStatus } from "../domain/quote-indicators";

/**
 * Lecturas de los indicadores comerciales.
 *
 * Todas las consultas son `select`: este archivo no inserta, no actualiza y no
 * elimina cotizaciones. La única escritura es el registro de auditoría de la
 * consulta (`record_quote_indicator_view`), que no toca datos de negocio.
 */

type QuoteRow = {
  id: string;
  code: string;
  client: string;
  responsible: string;
  status: QuoteStatus;
  estimated_value: string | number | null;
  received_at: string;
  sent_at: string | null;
  validity_days: number | null;
  updated_at: string;
};

type HistoryRow = {
  quote_id: string;
  from_status: QuoteStatus | null;
  to_status: QuoteStatus;
  changed_at: string;
  note: string | null;
};

export type QuoteIndicatorDataset = {
  quotes: QuoteIndicatorQuote[];
  history: QuoteIndicatorHistoryEntry[];
  companyId: string;
};

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

async function companyIdOf(supabase: NonNullable<ReturnType<typeof client>>): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("No hay sesión activa.");
  const { data, error } = await supabase
    .from("user_roles")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .limit(1);
  if (error) throw error;
  const companyId = data?.[0]?.company_id;
  if (!companyId) throw new Error("Tu cuenta no está vinculada a una empresa y rol.");
  return companyId;
}

/** Carga cotizaciones e historial de la empresa del usuario. */
export async function loadQuoteIndicatorDataset(): Promise<QuoteIndicatorDataset | null> {
  const supabase = client();
  if (!supabase) return null;

  const companyId = await companyIdOf(supabase);

  const [
    { data: quoteRows, error: quoteError },
    { data: historyRows, error: historyError },
  ] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, code, client, responsible, status, estimated_value, received_at, sent_at, validity_days, updated_at",
      )
      .eq("company_id", companyId)
      .order("received_at", { ascending: false }),
    supabase
      .from("quote_history")
      .select("quote_id, from_status, to_status, changed_at, note")
      .eq("company_id", companyId)
      .order("changed_at"),
  ]);

  if (quoteError) throw quoteError;
  if (historyError) throw historyError;

  const quotes: QuoteIndicatorQuote[] = ((quoteRows ?? []) as QuoteRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    client: row.client,
    responsible: row.responsible,
    status: row.status,
    estimatedValue: row.estimated_value == null ? null : Number(row.estimated_value),
    receivedAt: row.received_at,
    sentAt: row.sent_at,
    validityDays: row.validity_days,
    updatedAt: row.updated_at,
  }));

  const history: QuoteIndicatorHistoryEntry[] = ((historyRows ?? []) as HistoryRow[]).map(
    (row) => ({
      quoteId: row.quote_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      changedAt: row.changed_at,
      note: row.note,
    }),
  );

  return { quotes, history, companyId };
}

/**
 * Deja constancia de la consulta del informe con los filtros aplicados.
 * Si el registro falla, el informe se sigue mostrando: auditar no debe
 * impedir leer.
 */
export async function recordQuoteIndicatorView(
  filters: Record<string, string>,
  summary: { quotesInScope: number; won: number; lost: number },
): Promise<void> {
  const supabase = client();
  if (!supabase) return;
  await supabase.rpc("record_quote_indicator_view", {
    p_filters: filters,
    p_quotes_in_scope: summary.quotesInScope,
    p_won: summary.won,
    p_lost: summary.lost,
  });
}