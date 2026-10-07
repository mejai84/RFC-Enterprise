import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type {
  AttendanceEmployee,
  AttendanceProject,
  DeclaredLocationRecord,
  WorkCheckIn,
  CurrentWorkday,
  WorkdaySegment,
  WorkdaySegmentType,
  WorkCheckInWorkspaceData,
} from "../domain/work-check-in";
import type { AttendancePeriodKind } from "../domain/attendance-period";
import { bogotaToday } from "../domain/attendance-period";

/** Perfiles que, además de consultar su propia declaración, pueden ver la del equipo. */
export const REVIEW_ROLE_CODES = ["administrator", "resident_engineer", "auditor", "management"] as const;

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

/**
 * Errores de negocio que la RPC emite en texto claro para la persona, no para el
 * desarrollador. Cualquier otro fallo de Supabase se resume sin mostrar códigos
 * técnicos al usuario final.
 */
export function describeWorkCheckInError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause ?? "");
  const known: Array<[RegExp, string]> = [
    [/no está vinculada a un empleado activo/i, "Tu cuenta aún no está asociada a un empleado activo. Pide a administración que la vincule."],
    [/no autenticado|jwt|token/i, "Tu sesión no está activa. Vuelve a iniciar sesión."],
    [/obra elegida no pertenece/i, "La obra que elegiste no pertenece a tu empresa."],
    [/sitio entre 3 y 160/i, "Indica el sitio o frente de trabajo."],
    [/actividad entre 3 y 500/i, "Describe la actividad que estás realizando."],
    [/no se puede modificar ni eliminar/i, "Los registros de jornada no se pueden editar ni eliminar."],
    [/violates row-level security|row-level security/i, "No tienes permiso para registrar esta jornada."],
  ];
  for (const [pattern, message] of known) {
    if (pattern.test(raw)) return message;
  }
  return "No fue posible guardar el registro. Revisa los datos e inténtalo de nuevo.";
}

async function resolveCompany(supabase: NonNullable<ReturnType<typeof client>>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("company_id, roles(code)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.company_id) throw new Error("Tu cuenta no tiene una empresa asignada.");
  const role = Array.isArray(data.roles) ? data.roles[0] : data.roles;
  const canReview = REVIEW_ROLE_CODES.includes((role?.code ?? "") as (typeof REVIEW_ROLE_CODES)[number]);
  return { companyId: data.company_id as string, canReview };
}

function mapCheckIn(row: Record<string, unknown>): WorkCheckIn {
  const employee = (Array.isArray(row.employee) ? row.employee[0] : row.employee) as { full_name?: string } | null;
  const project = (Array.isArray(row.project) ? row.project[0] : row.project) as
    | { code?: string; name?: string }
    | null;
  const checkedInAt = String(row.checked_in_at);
  const localDate = (row.local_date as string | undefined) ?? checkedInAt.slice(0, 10);
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName: employee?.full_name ?? (row.employee_name as string | undefined) ?? "Empleado",
    projectId: (row.project_id as string | undefined) ?? undefined,
    projectLabel: (row.project_label as string | undefined) ?? (project ? `${project.code} · ${project.name}` : undefined),
    siteName: String(row.site_name),
    activityDescription: String(row.activity_description),
    checkedInAt,
    localDate,
    localTime: (row.local_time as string | undefined) ?? checkedInAt.slice(11, 16),
    location:
      typeof row.location_latitude === "number" && typeof row.location_longitude === "number"
        ? {
            latitude: row.location_latitude,
            longitude: row.location_longitude,
            accuracyMeters:
              typeof row.location_accuracy_m === "number" ? row.location_accuracy_m : null,
            label: (row.location_label as string | undefined) ?? undefined,
          }
        : undefined,
  };
}

export async function loadWorkCheckInWorkspaceData(): Promise<WorkCheckInWorkspaceData | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;

  const { companyId, canReview } = await resolveCompany(supabase, auth.user.id);

  const [ownEmployeeResult, projectsResult, employeesResult, checkInsResult] = await Promise.all([
    // El vínculo con el empleado sale de la sesión: nunca se elige a mano.
    supabase
      .from("employees")
      .select("id, full_name, job_title")
      .eq("profile_id", auth.user.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, code, name, location")
      .eq("company_id", companyId)
      .in("status", ["pending", "active"])
      .order("name"),
    supabase
      .from("employees")
      .select("id, full_name, job_title")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("full_name"),
    supabase.rpc("list_work_check_ins", {
      p_from: bogotaToday(),
      p_to: bogotaToday(),
      p_employee_id: null,
      p_project_id: null,
      p_search: null,
      p_limit: 12,
    }),
  ]);

  const own = ownEmployeeResult.data as { id: string; full_name: string; job_title: string | null } | null;
  const linkedEmployee: AttendanceEmployee | undefined = own
    ? { id: own.id, fullName: own.full_name, jobTitle: own.job_title ?? undefined }
    : undefined;

  return {
    employeeName: linkedEmployee?.fullName,
    canReview,
    projects: ((projectsResult.data ?? []) as Array<{ id: string; code: string; name: string; location: string | null }>).map(
      (project) => ({ id: project.id, label: `${project.code} · ${project.name}`, location: project.location ?? "" }),
    ),
    // Un empleado sin vínculo no registra: se le informa sin exponer la lista del equipo.
    employees: canReview
      ? ((employeesResult.data ?? []) as Array<{ id: string; full_name: string; job_title: string | null }>).map(
          (row) => ({ id: row.id, fullName: row.full_name, jobTitle: row.job_title ?? undefined }),
        )
      : linkedEmployee
        ? [linkedEmployee]
        : [],
    checkIns: ((checkInsResult.data ?? []) as Array<Record<string, unknown>>).map(mapCheckIn),
  };
}

/**
 * Carga las declaraciones del período. El filtro de período viaja al servidor para
 * que el día local se resuelva en Postgres y no dependa del huso del navegador.
 */
export async function loadAttendanceConsultation(input: {
  kind: AttendancePeriodKind;
  from: string;
  to: string;
  employeeId: string;
  projectId: string;
  search: string;
}): Promise<WorkCheckIn[]> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("list_work_check_ins", {
    p_from: input.from,
    p_to: input.to,
    p_employee_id: input.employeeId || null,
    p_project_id: input.projectId || null,
    p_search: input.search.trim() || null,
    p_limit: 800,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapCheckIn);
}

export async function loadAttendanceEmployees(): Promise<AttendanceEmployee[]> {
  const supabase = client();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { companyId } = await resolveCompany(supabase, auth.user.id);
  const { data } = await supabase
    .from("employees")
    .select("id, full_name, job_title")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("full_name");
  return ((data ?? []) as Array<{ id: string; full_name: string; job_title: string | null }>).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    jobTitle: row.job_title ?? undefined,
  }));
}

export async function loadAttendanceProjects(): Promise<AttendanceProject[]> {
  const supabase = client();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { companyId } = await resolveCompany(supabase, auth.user.id);
  const { data } = await supabase
    .from("projects")
    .select("id, code, name, location")
    .eq("company_id", companyId)
    .in("status", ["pending", "active"])
    .order("name");
  return ((data ?? []) as Array<{ id: string; code: string; name: string; location: string | null }>).map((project) => ({
    id: project.id,
    label: `${project.code} · ${project.name}`,
    location: project.location ?? "",
  }));
}

/**
 * Alta de la declaración. El navegador no inserta: llama a la RPC, que toma la hora
 * del servidor y resuelve empleado y empresa a partir de la sesión.
 */
export async function registerWorkCheckIn(
  projectId: string,
  siteName: string,
  activityDescription: string,
  location?: DeclaredLocationRecord,
) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("register_work_check_in", {
    p_project_id: projectId || null,
    p_site_name: siteName,
    p_activity_description: activityDescription,
    p_location_latitude: location?.latitude ?? null,
    p_location_longitude: location?.longitude ?? null,
    p_location_accuracy_m: location?.accuracyMeters ?? null,
    p_location_label: location?.label ?? null,
  });
  if (error) throw new Error(describeWorkCheckInError(error));
  return data as { id: string; checked_in_at: string } | null;
}

function mapCurrentWorkday(row: Record<string, unknown> | null): CurrentWorkday | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    localDate: String(row.local_date),
    startedAt: String(row.started_at),
    endedAt: (row.ended_at as string | null) ?? undefined,
    status: String(row.status) as CurrentWorkday["status"],
    currentSegment: row.current_segment_id
      ? {
          id: String(row.current_segment_id),
          type: String(row.current_segment_type) as WorkdaySegmentType,
          projectId: (row.project_id as string | null) ?? undefined,
          projectLabel: (row.project_label as string | null) ?? undefined,
          siteName: String(row.site_name),
          activityDescription: String(row.activity_description),
          startedAt: String(row.segment_started_at),
        }
      : undefined,
  };
}

export async function loadCurrentWorkday(): Promise<CurrentWorkday | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("current_workday");
  if (error) throw error;
  return mapCurrentWorkday((data?.[0] as Record<string, unknown> | undefined) ?? null);
}

/**
 * Tramos de la jornada de hoy, del más reciente al más antiguo.
 * Los lee la persona autenticada sobre sus propios registros; RLS impide ver
 * los de otros salvo a los perfiles de consulta autorizados.
 */
export async function loadMyWorkdaySegments(): Promise<WorkdaySegment[]> {
  const supabase = client();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  const today = bogotaToday();
  // El filtro va por la propia persona: aunque RLS deje ver tramos de terceros a
  // los perfiles de consulta, aquí solo se muestra la jornada del usuario.
  const { data, error } = await supabase
    .from("workday_segments")
    .select(
      "id, segment_type, project_id, site_name, activity_description, started_at, ended_at, workdays!inner(id, local_date, employees!inner(profile_id))",
    )
    .eq("workdays.local_date", today)
    .eq("workdays.employees.profile_id", userId)
    .order("started_at", { ascending: false })
    .limit(40);
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const workday = (Array.isArray(row.workdays) ? row.workdays[0] : row.workdays) as
      | { id: string }
      | undefined;
    const startedAt = String(row.started_at);
    return {
      id: String(row.id),
      workdayId: workday?.id ?? "",
      type: String(row.segment_type) as WorkdaySegmentType,
      projectId: (row.project_id as string | undefined) ?? undefined,
      siteName: String(row.site_name),
      activityDescription: String(row.activity_description),
      startedAt,
      endedAt: (row.ended_at as string | undefined) ?? undefined,
      localTime: new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(startedAt)),
    };
  });
}

type WorkdayActionInput = {
  projectId: string;
  siteName: string;
  activityDescription: string;
  location?: DeclaredLocationRecord;
};

function locationParams(location?: DeclaredLocationRecord) {
  return {
    p_location_latitude: location?.latitude ?? null,
    p_location_longitude: location?.longitude ?? null,
    p_location_accuracy_m: location?.accuracyMeters ?? null,
    p_location_label: location?.label ?? null,
  };
}

export async function startWorkday(input: WorkdayActionInput) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("start_workday", {
    p_project_id: input.projectId || null,
    p_site_name: input.siteName,
    p_activity_description: input.activityDescription,
    ...locationParams(input.location),
  });
  if (error) throw new Error(describeWorkCheckInError(error));
}

export async function changeWorkdaySegment(type: WorkdaySegmentType, input: WorkdayActionInput) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("change_workday_segment", {
    p_segment_type: type,
    p_project_id: input.projectId || null,
    p_site_name: input.siteName,
    p_activity_description: input.activityDescription,
    ...locationParams(input.location),
  });
  if (error) throw new Error(describeWorkCheckInError(error));
}

export async function finishWorkday(location?: DeclaredLocationRecord) {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("finish_workday", locationParams(location));
  if (error) throw new Error(describeWorkCheckInError(error));
}
