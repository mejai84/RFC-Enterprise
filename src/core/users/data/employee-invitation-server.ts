import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export type InvitationStatus =
  | "not_invited"
  | "invited"
  | "active"
  | "disabled"
  | "orphaned"
  | "linked";

export type InvitationStatusResult = {
  status: InvitationStatus;
  email: string;
  profileId: string | null;
  invitedAt: string | null;
  confirmedAt: string | null;
  lastSignInAt: string | null;
};

export type AdminContext = {
  admin: SupabaseClient;
  actorId: string;
  companyIds: string[];
};

export type AdminContextResult =
  | { context: AdminContext; error?: undefined; status?: undefined }
  | { context?: undefined; error: string; status: number };

/**
 * Cliente administrativo exclusivo de rutas de servidor. Nunca se importa desde
 * componentes cliente: la llave secreta no debe llegar al navegador.
 */
export function getAdminClient(): SupabaseClient | null {
  if (!supabaseUrl || !secretKey) return null;
  return createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Valida el bearer token del administrador y devuelve las empresas donde tiene
 * el rol `administrator`. La invitación no acepta companyId del navegador:
 * la empresa se deriva de la ficha y de la membresía del actor.
 */
export async function getAdminContext(request: Request): Promise<AdminContextResult> {
  const admin = getAdminClient();
  if (!admin) {
    return {
      error: "La invitación no está configurada en el servidor. Falta SUPABASE_SECRET_KEY.",
      status: 503,
    };
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return { error: "No autorizado.", status: 401 };

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: "Sesión no válida o expirada.", status: 401 };
  }

  const { data: memberships, error: membershipError } = await admin
    .from("user_roles")
    .select("company_id, roles!inner(code)")
    .eq("user_id", userData.user.id)
    .eq("roles.code", "administrator");

  if (membershipError) {
    return { error: "No fue posible validar tu membresía.", status: 502 };
  }

  const companyIds = [
    ...new Set((memberships ?? []).map((row) => row.company_id as string)),
  ];
  if (!companyIds.length) {
    return {
      error: "Solo una cuenta administradora puede invitar empleados.",
      status: 403,
    };
  }

  return { context: { admin, actorId: userData.user.id, companyIds } };
}

/**
 * Busca una cuenta Auth existente por correo. La API admin de Supabase no
 * expone filtro por correo en esta versión, así que se pagina con un límite
 * explícito para no recorrer usuarios sin control.
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ user?: User; error?: string }> {
  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) return { error: error.message };
    const users = data?.users ?? [];
    const found = users.find(
      (user) => user.email?.trim().toLowerCase() === normalized,
    );
    if (found) return { user: found };
    if (users.length < 1000) break;
  }
  return {};
}

export async function getInvitationStatus(
  admin: SupabaseClient,
  profileId: string | null,
  employeeEmail: string,
): Promise<InvitationStatusResult> {
  if (!profileId) {
    return {
      status: "not_invited",
      email: employeeEmail,
      profileId: null,
      invitedAt: null,
      confirmedAt: null,
      lastSignInAt: null,
    };
  }

  const { data, error } = await admin.auth.admin.getUserById(profileId);
  if (error || !data?.user) {
    return {
      status: "orphaned",
      email: employeeEmail,
      profileId,
      invitedAt: null,
      confirmedAt: null,
      lastSignInAt: null,
    };
  }

  const user = data.user;
  const banned =
    Boolean(user.banned_until) &&
    new Date(user.banned_until as string).getTime() > Date.now();
  const confirmed = Boolean(user.email_confirmed_at || user.last_sign_in_at);
  const invited = Boolean(user.invited_at || user.confirmation_sent_at);

  return {
    status: banned ? "disabled" : confirmed ? "active" : invited ? "invited" : "linked",
    email: user.email || employeeEmail,
    profileId,
    invitedAt: user.invited_at ?? null,
    confirmedAt: user.email_confirmed_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

/**
 * Sincroniza la membresía con el rol base de la ficha. El modelo actual usa un
 * rol base por empleado; se reemplazan las filas previas de esa empresa para
 * evitar roles obsoletos, igual que el flujo de restablecimiento existente.
 */
export async function syncEmployeeMembership(
  admin: SupabaseClient,
  input: {
    userId: string;
    companyId: string;
    branchId: string;
    roleId: string;
  },
): Promise<{ error?: string }> {
  // Primero se asegura la membresía nueva; si algo falla, el usuario conserva
  // el acceso que ya tenía en lugar de quedar sin rol.
  const { error: insertError } = await admin.from("user_roles").upsert(
    {
      user_id: input.userId,
      company_id: input.companyId,
      branch_id: input.branchId,
      role_id: input.roleId,
    },
    { onConflict: "user_id,role_id,company_id,branch_id" },
  );
  if (insertError) return { error: insertError.message };

  const { data: currentRows, error: readError } = await admin
    .from("user_roles")
    .select("role_id, branch_id")
    .eq("user_id", input.userId)
    .eq("company_id", input.companyId);
  if (readError) return { error: readError.message };

  const staleRows = (currentRows ?? []).filter(
    (row) =>
      row.role_id !== input.roleId || row.branch_id !== input.branchId,
  );
  for (const row of staleRows) {
    const { error: deleteError } = await admin
      .from("user_roles")
      .delete()
      .match({
        user_id: input.userId,
        company_id: input.companyId,
        role_id: row.role_id,
        branch_id: row.branch_id,
      });
    if (deleteError) return { error: deleteError.message };
  }

  return {};
}

export async function writeEmployeeAudit(
  admin: SupabaseClient,
  input: {
    companyId: string;
    actorId: string;
    employeeId: string;
    action: string;
    afterData: Record<string, unknown>;
  },
): Promise<{ error?: string }> {
  const { error } = await admin.from("audit_logs").insert({
    company_id: input.companyId,
    actor_id: input.actorId,
    entity_type: "employee",
    entity_id: input.employeeId,
    action: input.action,
    after_data: input.afterData,
  });
  return error ? { error: error.message } : {};
}
