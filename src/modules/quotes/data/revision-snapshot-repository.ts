import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { QuoteCostBreakdown } from "../domain/quote";
import type {
  QuoteRevisionActivity,
  QuoteRevisionFields,
  QuoteRevisionSnapshot,
} from "../domain/revision-comparison";

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

type SnapshotRow = {
  revision: number;
  snapshot: Partial<QuoteRevisionFields> | null;
  captured_at: string;
};

type ApuAnalysisRow = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  status: string;
};

type ApuVersionRow = {
  apu_analysis_id: string;
  version_number: number;
  total_cost: string | number | null;
  created_at: string;
};

function emptyFields(): QuoteRevisionFields {
  return {
    estimatedValue: null,
    costBreakdown: null,
    validityDays: null,
    deliveryTimeWeeks: null,
    paymentTerms: null,
    title: null,
    notes: null,
    status: null,
    receivedAt: null,
    sentAt: null,
    deadline: null,
    updatedAt: null,
  };
}

function toFields(snapshot: Partial<QuoteRevisionFields> | null): QuoteRevisionFields {
  if (!snapshot) return emptyFields();
  return {
    estimatedValue: snapshot.estimatedValue ?? null,
    costBreakdown: (snapshot.costBreakdown as QuoteCostBreakdown | null) ?? null,
    validityDays: snapshot.validityDays ?? null,
    deliveryTimeWeeks: snapshot.deliveryTimeWeeks ?? null,
    paymentTerms: snapshot.paymentTerms ?? null,
    title: snapshot.title ?? null,
    notes: snapshot.notes ?? null,
    status: snapshot.status ?? null,
    receivedAt: snapshot.receivedAt ?? null,
    sentAt: snapshot.sentAt ?? null,
    deadline: snapshot.deadline ?? null,
    updatedAt: snapshot.updatedAt ?? null,
  };
}

/**
 * Para cada instantánea toma la última versión de cada APU creada hasta ese
 * momento. Así el APU que se compara es el que estaba vigente en esa revisión
 * y no el de hoy.
 */
function activitiesAt(
  capturedAt: string,
  analyses: ApuAnalysisRow[],
  versions: ApuVersionRow[],
): QuoteRevisionActivity[] {
  const moment = new Date(capturedAt).getTime();
  const byAnalysisId = new Map(analyses.map((analysis) => [analysis.id, analysis]));
  const latestByCode = new Map<string, ApuVersionRow>();

  for (const version of versions) {
    const analysis = byAnalysisId.get(version.apu_analysis_id);
    if (!analysis) continue;
    if (Number.isFinite(moment) && new Date(version.created_at).getTime() > moment) continue;
    const current = latestByCode.get(analysis.code);
    if (
      !current ||
      new Date(version.created_at).getTime() > new Date(current.created_at).getTime()
    ) {
      latestByCode.set(analysis.code, version);
    }
  }

  return analyses
    .filter((analysis) => analysis.status !== "archived")
    .map((analysis) => {
      const version = latestByCode.get(analysis.code);
      return {
        code: analysis.code,
        name: analysis.name,
        unit: analysis.unit,
        versionNumber: version?.version_number ?? null,
        totalCost: version?.total_cost == null ? null : Number(version.total_cost),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Empresa del usuario: las lecturas se acotan a su compañía. */
async function companyIdOf(
  supabase: NonNullable<ReturnType<typeof client>>,
): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("No hay sesión activa.");
  const { data, error } = await supabase
    .from("user_roles")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .limit(1);
  if (error) throw error;
  const companyId = data?.[0]?.company_id;
  if (!companyId) throw new Error("Tu cuenta no está vinculada a una empresa.");
  return companyId;
}

/**
 * Carga las revisiones comparables de una cotización.
 *
 * Solo lectura: consulta `quote_revision_snapshots` y los APU vinculados a la
 * cotización. No escribe nada ni interviene en la creación de revisiones.
 */
export async function loadQuoteRevisionSnapshots(
  quoteId: string,
): Promise<QuoteRevisionSnapshot[]> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const companyId = await companyIdOf(supabase);

  const [
    { data: snapshotRows, error: snapshotError },
    { data: analysisRows, error: analysisError },
  ] = await Promise.all([
    supabase
      .from("quote_revision_snapshots")
      .select("revision, snapshot, captured_at")
      .eq("quote_id", quoteId)
      .order("revision"),
    supabase
      .from("apu_analyses")
      .select("id, code, name, unit, status")
      .eq("quote_id", quoteId),
  ]);

  if (snapshotError) throw snapshotError;
  if (analysisError) throw analysisError;

  const analyses = (analysisRows ?? []) as ApuAnalysisRow[];
  let versions: ApuVersionRow[] = [];

  if (analyses.length) {
    const { data: versionRows, error: versionError } = await supabase
      .from("apu_versions")
      .select("apu_analysis_id, version_number, total_cost, created_at")
      .eq("company_id", companyId)
      .in(
        "apu_analysis_id",
        analyses.map((analysis) => analysis.id),
      );
    if (versionError) throw versionError;
    versions = (versionRows ?? []) as ApuVersionRow[];
  }

  return ((snapshotRows ?? []) as SnapshotRow[]).map((row) => ({
    revision: row.revision,
    capturedAt: row.captured_at,
    activities: activitiesAt(row.captured_at, analyses, versions),
    fields: toFields(row.snapshot),
  }));
}

/** Motivo de creación de cada revisión, tomado del historial de la cotización. */
export async function loadQuoteRevisionReasons(
  quoteId: string,
): Promise<Record<number, string>> {
  const supabase = client();
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("quote_history")
    .select("note")
    .eq("quote_id", quoteId);
  if (error) return {};

  const reasons: Record<number, string> = {};
  for (const row of data ?? []) {
    const note = typeof row.note === "string" ? row.note : "";
    const match = note.match(/Creaci[oó]n de Revisi[oó]n R(\d+)\s*:\s*(.+)$/i);
    if (match) {
      const revision = Number(match[1]);
      if (Number.isFinite(revision) && match[2].trim()) reasons[revision] = match[2].trim();
    }
  }
  return reasons;
}