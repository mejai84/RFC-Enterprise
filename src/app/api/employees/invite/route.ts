import { NextRequest, NextResponse } from "next/server";
import {
  findAuthUserByEmail,
  getAdminContext,
  getInvitationStatus,
  syncEmployeeMembership,
  writeEmployeeAudit,
} from "@/core/users/data/employee-invitation-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count += 1;
  return false;
}

function siteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  const auth = await getAdminContext(request);
  if (!auth.context) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }
  const { admin, actorId, companyIds } = auth.context;

  if (isRateLimited(`actor:${actorId}`)) {
    return NextResponse.json(
      { error: "Demasiadas invitaciones. Espera un minuto antes de reintentar." },
      { status: 429 },
    );
  }

  const payload = await request.json().catch(() => ({}));
  const employeeId = String(payload.employeeId ?? "").trim();
  if (!employeeId || !UUID_REGEX.test(employeeId)) {
    return NextResponse.json(
      { error: "Identificador de empleado no válido." },
      { status: 400 },
    );
  }

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select(
      "id, full_name, email, company_id, branch_id, profile_id, is_active",
    )
    .eq("id", employeeId)
    .in("company_id", companyIds)
    .maybeSingle();

  if (employeeError) {
    return NextResponse.json(
      { error: "No fue posible consultar la ficha del empleado." },
      { status: 502 },
    );
  }
  if (!employee) {
    return NextResponse.json(
      { error: "El empleado no existe o no pertenece a tu empresa." },
      { status: 404 },
    );
  }
  if (!employee.is_active) {
    return NextResponse.json(
      { error: "Activa la ficha del empleado antes de invitarlo." },
      { status: 422 },
    );
  }

  const { data: employeeRole, error: roleError } = await admin
    .from("employee_roles")
    .select("role_id")
    .eq("employee_id", employee.id)
    .limit(1)
    .maybeSingle();
  if (roleError) {
    return NextResponse.json(
      { error: "No fue posible consultar el rol del empleado." },
      { status: 502 },
    );
  }
  if (!employeeRole?.role_id) {
    return NextResponse.json(
      { error: "Asigna un rol base al empleado antes de invitarlo." },
      { status: 422 },
    );
  }

  let branchId = employee.branch_id as string | null;
  if (!branchId) {
    const { data: actorMembership } = await admin
      .from("user_roles")
      .select("branch_id")
      .eq("user_id", actorId)
      .eq("company_id", employee.company_id)
      .not("branch_id", "is", null)
      .limit(1)
      .maybeSingle();
    branchId = (actorMembership?.branch_id as string | null) ?? null;
  }
  if (!branchId) {
    return NextResponse.json(
      {
        error:
          "El empleado necesita una sede antes de recibir acceso. Edita su ficha o asigna una sede a tu membresía.",
      },
      { status: 422 },
    );
  }

  const origin = siteOrigin(request);
  const inviteRedirect = `${origin}/login?invited=1`;
  const recoveryRedirect = `${origin}/restablecer-contrasena?mode=recovery`;

  const currentStatus = await getInvitationStatus(
    admin,
    employee.profile_id as string | null,
    employee.email,
  );

  // Si ya hay una cuenta válida, se sincroniza la membresía y se informa el
  // estado. No se envía otro correo para no convertir la acción en un reset
  // silencioso. El botón existente de recuperación cubre el reenvío.
  if (employee.profile_id && currentStatus.status !== "orphaned") {
    const membership = await syncEmployeeMembership(admin, {
      userId: employee.profile_id as string,
      companyId: employee.company_id,
      branchId,
      roleId: employeeRole.role_id,
    });
    if (membership.error) {
      return NextResponse.json(
        {
          error:
            "La cuenta existe, pero no se pudo sincronizar su membresía: " +
            membership.error,
        },
        { status: 502 },
      );
    }
    const audit = await writeEmployeeAudit(admin, {
      companyId: employee.company_id,
      actorId,
      employeeId: employee.id,
      action: "employee_membership_synced",
      afterData: {
        profile_id: employee.profile_id,
        email: employee.email,
        role_id: employeeRole.role_id,
        branch_id: branchId,
        status: currentStatus.status,
      },
    });
    return NextResponse.json({
      ok: true,
      alreadyLinked: true,
      emailSent: false,
      warning: audit.error
        ? `La membresía se sincronizó, pero no se pudo registrar la auditoría: ${audit.error}`
        : undefined,
      ...currentStatus,
    });
  }

  let profileId: string | null = null;
  let emailSent = false;
  let existingAccount = false;
  let warning = "";

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(employee.email, {
      redirectTo: inviteRedirect,
      data: { full_name: employee.full_name },
    });

  if (!inviteError && invited.user) {
    profileId = invited.user.id;
    emailSent = true;
  } else {
    // La cuenta puede existir sin estar vinculada a la ficha. En ese caso se
    // enlaza y se envía un enlace de recuperación para que establezca su clave.
    const existing = await findAuthUserByEmail(admin, employee.email);
    if (existing.error) {
      warning = "No se pudo verificar si el correo ya tenía cuenta.";
    }
    if (existing.user) {
      profileId = existing.user.id;
      existingAccount = true;
      const { data: conflict, error: conflictError } = await admin
        .from("employees")
        .select("id")
        .eq("profile_id", existing.user.id)
        .eq("company_id", employee.company_id)
        .neq("id", employee.id)
        .maybeSingle();
      if (conflictError) {
        return NextResponse.json(
          { error: "No fue posible verificar si la cuenta ya estaba vinculada." },
          { status: 502 },
        );
      }
      if (conflict) {
        return NextResponse.json(
          {
            error:
              "La cuenta de ese correo ya está vinculada a otra ficha de empleado en esta empresa.",
          },
          { status: 409 },
        );
      }
      const { error: resetError } =
        await admin.auth.resetPasswordForEmail(employee.email, {
          redirectTo: recoveryRedirect,
        });
      if (resetError) {
        warning =
          "La cuenta existente se vinculó, pero el correo de acceso no se pudo enviar: " +
          resetError.message;
      } else {
        emailSent = true;
      }
    } else {
      return NextResponse.json(
        {
          error:
            inviteError?.message ||
            "No fue posible crear la cuenta ni enviar la invitación.",
        },
        { status: 502 },
      );
    }
  }

  if (!profileId) {
    return NextResponse.json(
      { error: "No fue posible obtener la identidad de la cuenta invitada." },
      { status: 502 },
    );
  }

  const { data: linkedElsewhere, error: linkedElsewhereError } = await admin
    .from("employees")
    .select("id")
    .eq("profile_id", profileId)
    .eq("company_id", employee.company_id)
    .neq("id", employee.id)
    .maybeSingle();
  if (linkedElsewhereError) {
    return NextResponse.json(
      { error: "No fue posible verificar si la cuenta ya estaba vinculada." },
      { status: 502 },
    );
  }
  if (linkedElsewhere) {
    return NextResponse.json(
      {
        error:
          "La cuenta de ese correo ya está vinculada a otra ficha de empleado. Revisa el directorio antes de continuar.",
      },
      { status: 409 },
    );
  }

  const { error: linkError } = await admin
    .from("employees")
    .update({ profile_id: profileId })
    .eq("id", employee.id)
    .eq("company_id", employee.company_id);
  if (linkError) {
    return NextResponse.json(
      {
        error:
          "La cuenta se creó, pero no se pudo vincular con la ficha: " +
          linkError.message,
      },
      { status: 502 },
    );
  }

  const membership = await syncEmployeeMembership(admin, {
    userId: profileId,
    companyId: employee.company_id,
    branchId,
    roleId: employeeRole.role_id,
  });
  if (membership.error) {
    return NextResponse.json(
      {
        error:
          "La cuenta se creó y se vinculó, pero no se pudo asignar la membresía: " +
          membership.error,
      },
      { status: 502 },
    );
  }

  const audit = await writeEmployeeAudit(admin, {
    companyId: employee.company_id,
    actorId,
    employeeId: employee.id,
    action: existingAccount ? "employee_linked_existing" : "employee_invited",
    afterData: {
      profile_id: profileId,
      email: employee.email,
      role_id: employeeRole.role_id,
      branch_id: branchId,
      email_sent: emailSent,
      existing_account: existingAccount,
    },
  });
  if (audit.error) {
    warning = [warning, `No se pudo registrar la auditoría: ${audit.error}`]
      .filter(Boolean)
      .join(" ");
  }

  const status = await getInvitationStatus(
    admin,
    profileId,
    employee.email,
  );

  return NextResponse.json({
    ok: true,
    alreadyLinked: false,
    emailSent,
    existingAccount,
    warning: warning || undefined,
    ...status,
  });
}
