import { NextRequest, NextResponse } from "next/server";
import {
  getAdminContext,
  getInvitationStatus,
} from "@/core/users/data/employee-invitation-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 120;
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

export async function GET(request: NextRequest) {
  const auth = await getAdminContext(request);
  if (!auth.context) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }
  const { admin, actorId, companyIds } = auth.context;

  if (isRateLimited(`status:${actorId}`)) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429 },
    );
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId")?.trim() ?? "";
  if (!employeeId || !UUID_REGEX.test(employeeId)) {
    return NextResponse.json(
      { error: "Identificador de empleado no válido." },
      { status: 400 },
    );
  }

  const { data: employee, error } = await admin
    .from("employees")
    .select("id, email, profile_id, company_id")
    .eq("id", employeeId)
    .in("company_id", companyIds)
    .maybeSingle();

  if (error) {
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

  const status = await getInvitationStatus(
    admin,
    employee.profile_id as string | null,
    employee.email,
  );

  return NextResponse.json({
    ok: true,
    employeeId: employee.id,
    ...status,
  });
}
