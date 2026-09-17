import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export async function POST(request: NextRequest) {
  if (!url || !publishableKey || !secretKey) return NextResponse.json({ error: "La recuperación no está configurada en el servidor." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const payload = await request.json().catch(() => ({}));
  const employeeId = String(payload.employeeId ?? "");
  const password = String(payload.password ?? "");
  if (!token || !employeeId) return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });

  const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { data: memberships } = await admin.from("user_roles").select("company_id, roles!inner(code)").eq("user_id", userData.user.id).eq("roles.code", "administrator");
  const companyIds = (memberships ?? []).map((membership) => membership.company_id);
  if (!companyIds.length) return NextResponse.json({ error: "No tienes permiso para restablecer contraseñas." }, { status: 403 });

  const { data: employee } = await admin.from("employees").select("email, profile_id, company_id, is_active").eq("id", employeeId).in("company_id", companyIds).maybeSingle();
  if (!employee?.email || !employee.is_active) return NextResponse.json({ error: "El empleado no está activo o no pertenece a tu empresa." }, { status: 404 });
  if (password) {
    if (password.length < 8 || !employee.profile_id) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres y el empleado debe tener una cuenta activa." }, { status: 400 });
    const { error: updateError } = await admin.auth.admin.updateUserById(employee.profile_id, { password });
    if (updateError) return NextResponse.json({ error: "No fue posible establecer la contraseña." }, { status: 502 });
    return NextResponse.json({ ok: true, direct: true });
  }
  const redirectTo = `${request.nextUrl.origin}/restablecer-contrasena?mode=recovery`;
  const { error: resetError } = await admin.auth.resetPasswordForEmail(employee.email, { redirectTo });
  if (resetError) return NextResponse.json({ error: "No fue posible enviar el correo de recuperación." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
