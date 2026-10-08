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

export async function getLaborPositionCatalog(laborRateTableId?: string): Promise<LaborPositionCatalog> {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    return { positions: localCatalog(), source: "fallback", warning: "Supabase no esta configurado; se muestra el respaldo local." };
  }

  const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { positions: localCatalog(), source: "fallback", warning: "No hay una sesion activa para consultar los cargos de la empresa; se muestra el respaldo local." };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("user_roles").select("company_id").eq("user_id", auth.user.id).limit(1);
  const companyId = memberships?.[0]?.company_id;
  if (membershipError || !companyId) {
    return { positions: localCatalog(), source: "fallback", warning: "No fue posible identificar la empresa de la sesion; se muestra el respaldo local." };
  }

  if (laborRateTableId) {
    const [{ data: table, error: tableError }, { data: roles, error: rolesError }, { data: entries, error: entriesError }] = await Promise.all([
      supabase.from("labor_rate_tables").select("id,name,activity_type,valid_from,valid_to,source_document").eq("id", laborRateTableId).eq("company_id", companyId).maybeSingle(),
      supabase.from("labor_rate_roles").select("id,code,name,specialty,specialty_label,summary,receives_hotel,receives_operational_transport,labor_rate_entry_id").eq("labor_rate_table_id", laborRateTableId).eq("is_active", true).order("name"),
      supabase.from("labor_rate_entries").select("id,code,name,level,daily_basic_salary,transport_allowance,food_allowance,non_salary_allowance,total_daily_rate").eq("labor_rate_table_id", laborRateTableId).order("sort_order").order("name"),
    ]);
    if (tableError || rolesError || entriesError || !table) {
      return { positions: [], source: "database", warning: tableError?.message || rolesError?.message || entriesError?.message || "La tabla salarial de la cotizacion no esta disponible." };
    }
    const rateByEntry = new Map((entries ?? []).map((entry) => [entry.id, entry]));
    const tableType = table.activity_type === "no_propias" ? "no_propias" : "propias";
    const positions = (roles ?? []).flatMap((role) => {
      const rate = rateByEntry.get(role.labor_rate_entry_id);
      if (!rate) return [];
      return [{
        id: role.id,
        code: role.code,
        name: role.name,
        activityType: tableType,
        specialty: role.specialty,
        specialtyLabel: role.specialty_label,
        level: Number(rate.level ?? 0),
        dailyBasicSalary: Number(rate.daily_basic_salary),
        transportAllowance: Number(rate.transport_allowance),
        foodAllowance: Number(rate.food_allowance),
        nonSalaryAllowance: Number(rate.non_salary_allowance),
        totalDailyRate: Number(rate.total_daily_rate),
        validFrom: table.valid_from,
        validTo: table.valid_to ?? "",
        sourceDocument: table.source_document,
        summary: role.summary,
        receivesHotel: role.receives_hotel,
        receivesOperationalTransport: role.receives_operational_transport,
      } satisfies LaborPosition];
    });
    if (positions.length) return { positions, source: "database" };

    const directRoles = (entries ?? []).filter((entry) => !/^nivel\s*\d+$/i.test(entry.name.trim())).map((entry) => ({
      id: entry.id, code: entry.code, name: entry.name, activityType: tableType,
      specialty: "general", specialtyLabel: "General", level: Number(entry.level ?? 0),
      dailyBasicSalary: Number(entry.daily_basic_salary), transportAllowance: Number(entry.transport_allowance),
      foodAllowance: Number(entry.food_allowance), nonSalaryAllowance: Number(entry.non_salary_allowance),
      totalDailyRate: Number(entry.total_daily_rate), validFrom: table.valid_from, validTo: table.valid_to ?? "",
      sourceDocument: table.source_document, summary: "Cargo importado desde la tabla salarial.",
      receivesHotel: /capataz|conductor/i.test(entry.name), receivesOperationalTransport: /capataz|conductor/i.test(entry.name),
    } satisfies LaborPosition));
    if (directRoles.length) return { positions: directRoles, source: "database" };
    // A newly imported table can initially contain only levels. In that case the
    // RFC role catalog is retained, but every value is replaced by this table's level.
    const rateByLevel = new Map((entries ?? []).filter((entry) => entry.level !== null).map((entry) => [Number(entry.level), entry]));
    const mapped = localCatalog().filter((position) => position.activityType === tableType).flatMap((position) => {
      const rate = rateByLevel.get(position.level);
      if (!rate) return [];
      return [{ ...position, id: `${laborRateTableId}:${position.code}`, dailyBasicSalary: Number(rate.daily_basic_salary), transportAllowance: Number(rate.transport_allowance), foodAllowance: Number(rate.food_allowance), nonSalaryAllowance: Number(rate.non_salary_allowance), totalDailyRate: Number(rate.total_daily_rate), validFrom: table.valid_from, validTo: table.valid_to ?? "", sourceDocument: table.source_document, receivesHotel: /capataz|conductor/i.test(position.name), receivesOperationalTransport: /capataz|conductor/i.test(position.name) }];
    });
    return { positions: mapped, source: "database", warning: "La tabla solo trae niveles. Se muestran los cargos RFC equivalentes con los valores de la tabla seleccionada; registre los cargos de este cliente para personalizar el catalogo." };
  }

  const { data, error } = await supabase.from("apu_labor_positions")
    .select("id, code, name, activity_type, specialty, specialty_label, level, daily_basic_salary, transport_allowance, food_allowance, non_salary_allowance, total_daily_rate, valid_from, valid_to, source_document, summary")
    .eq("company_id", companyId).eq("is_active", true).order("name");
  if (error || !data?.length) {
    return { positions: localCatalog(), source: "fallback", warning: error?.message || "La base de datos no devolvio cargos; se muestra el respaldo local." };
  }
  return { positions: (data as LaborPositionRow[]).map(mapRow), source: "database" };
}