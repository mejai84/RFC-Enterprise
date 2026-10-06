import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

// Control de tasa de peticiones en memoria (5 solicitudes por minuto por IP o usuario)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  entry.count += 1;
  return false;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!url || !secretKey) {
    return NextResponse.json(
      { error: "La recuperación no está configurada en el servidor." },
      { status: 503 }
    );
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  if (checkRateLimit(`ip:${clientIp}`)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un minuto antes de reintentar." },
      { status: 429 }
    );
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const employeeId = String(payload.employeeId ?? "").trim();
  const password = payload.password ? String(payload.password) : "";

  if (!employeeId || !UUID_REGEX.test(employeeId)) {
    return NextResponse.json({ error: "Identificador de empleado no válido." }, { status: 400 });
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sesión no válida o expirada." }, { status: 401 });
  }

  if (checkRateLimit(`user:${userData.user.id}`)) {
    return NextResponse.json(
      { error: "Has superado el límite de operaciones por minuto." },
      { status: 429 }
    );
  }

  const { data: memberships } = await admin
    .from("user_roles")
    .select("company_id, branch_id, roles!inner(code)")
    .eq("user_id", userData.user.id)
    .eq("roles.code", "administrator");

  const companyIds = (memberships ?? []).map((membership) => membership.company_id);
  if (!companyIds.length) {
    return NextResponse.json(
      { error: "No tienes permiso de administrador para restablecer contraseñas." },
      { status: 403 }
    );
  }

  const { data: employee } = await admin
    .from("employees")
    .select("id, email, profile_id, company_id, branch_id, is_active")
    .eq("id", employeeId)
    .in("company_id", companyIds)
    .maybeSingle();

  if (!employee?.email || !employee.is_active) {
    return NextResponse.json(
      { error: "El empleado no está activo o no pertenece a tu empresa." },
      { status: 404 }
    );
  }

  if (password) {
    if (password.length < 10) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 10 caracteres." },
        { status: 400 }
      );
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSymbol) {
      return NextResponse.json(
        {
          error:
            "La contraseña debe contener mayúsculas, minúsculas, números y al menos un símbolo.",
        },
        { status: 400 }
      );
    }

    let profileId = employee.profile_id;

    // Si el empleado no tiene cuenta Auth, crearla automáticamente
    if (!profileId) {
      const { data: newUser, error: createUserError } =
        await admin.auth.admin.createUser({
          email: employee.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: employee.email },
        });

      if (createUserError || !newUser?.user) {
        return NextResponse.json(
          {
            error:
              createUserError?.message ||
              "No fue posible crear la cuenta de acceso para el empleado.",
          },
          { status: 502 }
        );
      }

      profileId = newUser.user.id;

      // Vincular profile_id al empleado
      await admin
        .from("employees")
        .update({ profile_id: profileId })
        .eq("id", employee.id);

      // El trigger `employees_sync_user_role` sincroniza la membresía efectiva
      // al vincular la identidad Auth con la ficha y su rol laboral.

      const { data: employeeRole } = await admin
        .from("employee_roles")
        .select("role_id")
        .eq("employee_id", employee.id)
        .maybeSingle();
      const accessBranchId = employee.branch_id ?? memberships?.[0]?.branch_id;
      if (!employeeRole?.role_id || !accessBranchId) {
        return NextResponse.json({ error: "El empleado necesita sede y rol antes de activar su acceso." }, { status: 422 });
      }
      const { error: membershipError } = await admin.from("user_roles").insert({
        user_id: profileId,
        company_id: employee.company_id,
        branch_id: accessBranchId,
        role_id: employeeRole.role_id,
      });
      if (membershipError) {
        return NextResponse.json({ error: "La cuenta fue creada, pero no se pudo asignar su acceso: " + membershipError.message }, { status: 502 });
      }

      // Registrar en auditoría
      await admin.from("audit_logs").insert({
        company_id: employee.company_id,
        actor_id: userData.user.id,
        entity_type: "employee",
        entity_id: employee.id,
        action: "auth_account_created",
        after_data: {
          profile_id: profileId,
          employee_email: employee.email,
        },
      });

      return NextResponse.json({ ok: true, direct: true, accountCreated: true });
    }

    // Si ya tiene profile_id, actualizar la contraseña
    const { error: updateError } = await admin.auth.admin.updateUserById(profileId, {
      password,
    });
    if (updateError) {
      return NextResponse.json(
        { error: "No fue posible establecer la nueva contraseña." },
        { status: 502 }
      );
    }

    const { data: employeeRole } = await admin
      .from("employee_roles")
      .select("role_id")
      .eq("employee_id", employee.id)
      .maybeSingle();
    const accessBranchId = employee.branch_id ?? memberships?.[0]?.branch_id;
    if (!employeeRole?.role_id || !accessBranchId) {
      return NextResponse.json({ error: "El empleado necesita sede y rol antes de activar su acceso." }, { status: 422 });
    }
    await admin.from("user_roles").delete().eq("user_id", profileId).eq("company_id", employee.company_id);
    const { error: membershipError } = await admin.from("user_roles").insert({
      user_id: profileId,
      company_id: employee.company_id,
      branch_id: accessBranchId,
      role_id: employeeRole.role_id,
    });
    if (membershipError) {
      return NextResponse.json({ error: "No se pudo sincronizar el rol de acceso: " + membershipError.message }, { status: 502 });
    }

    // Registrar en auditoría
    await admin.from("audit_logs").insert({
      company_id: employee.company_id,
      actor_id: userData.user.id,
      entity_type: "employee",
      entity_id: employee.id,
      action: "password_direct_reset",
      after_data: { direct: true, employee_email: employee.email },
    });

    return NextResponse.json({ ok: true, direct: true });
  }

  const redirectTo = `${request.nextUrl.origin}/restablecer-contrasena?mode=recovery`;
  const { error: resetError } = await admin.auth.resetPasswordForEmail(employee.email, {
    redirectTo,
  });

  if (resetError) {
    return NextResponse.json(
      { error: "No fue posible enviar el correo de recuperación." },
      { status: 502 }
    );
  }

  // Registrar en auditoría
  await admin.from("audit_logs").insert({
    company_id: employee.company_id,
    actor_id: userData.user.id,
    entity_type: "employee",
    entity_id: employee.id,
    action: "password_reset_email_requested",
    after_data: { email_sent_to: employee.email },
  });

  return NextResponse.json({ ok: true });
}
