import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { ocensaLaborPositions } from "@/modules/quotes";
import type { LaborPosition, LaborPositionCatalog } from "../domain/labor-position";

type LaborPositionRow = {
  id: string;
  code: string;
  name: string;
  activity_type: LaborPosition["activityType"];
  specialty: string;
  specialty_label: string;
  level: number;
  daily_basic_salary: number;
  transport_allowance: number;
  food_allowance: number;
  non_salary_allowance: number;
  total_daily_rate: number;
  valid_from: string;
  valid_to: string;
  source_document: string;
  summary: string;
};

function localCatalog(): LaborPosition[] {
  return ocensaLaborPositions.map((position) => ({
    ...position,
    nonSalaryAllowance: position.nonSalaryAllowance ?? 0,
    validFrom: position.activityType === "propias" ? "2026-07-01" : "2026-01-01",
    validTo: position.activityType === "propias" ? "2027-06-30" : "2026-12-31",
    sourceDocument: "TABLA SALARIAL LABORALES PARA CONTRATISTAS JUL2026-JUN2027.pdf",
  }));
}

function mapRow(row: LaborPositionRow): LaborPosition {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    activityType: row.activity_type,
    specialty: row.specialty,
    specialtyLabel: row.specialty_label,
    level: row.level,
    dailyBasicSalary: Number(row.daily_basic_salary),
    transportAllowance: Number(row.transport_allowance),
    foodAllowance: Number(row.food_allowance),
    nonSalaryAllowance: Number(row.non_salary_allowance),
    totalDailyRate: Number(row.total_daily_rate),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    sourceDocument: row.source_document,
    summary: row.summary,
  };
}

export async function getLaborPositionCatalog(): Promise<LaborPositionCatalog> {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    return { positions: localCatalog(), source: "fallback", warning: "Supabase no está configurado; se muestra el respaldo local." };
  }

  const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
  const { data, error } = await supabase
    .from("apu_labor_positions")
    .select("id, code, name, activity_type, specialty, specialty_label, level, daily_basic_salary, transport_allowance, food_allowance, non_salary_allowance, total_daily_rate, valid_from, valid_to, source_document, summary")
    .eq("is_active", true)
    .order("name");

  if (error || !data?.length) {
    return {
      positions: localCatalog(),
      source: "fallback",
      warning: error?.message || "La base de datos no devolvió cargos; se muestra el respaldo local.",
    };
  }

  return { positions: (data as LaborPositionRow[]).map(mapRow), source: "database" };
}
