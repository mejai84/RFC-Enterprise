import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

// ─── Tipos ───────────────────────────────────────────────────

export type EmployeeStockItem = {
  stockId: string;
  itemName: string;
  unit: string;
  available: number;
  category: string;
};

export type EmployeeRequisitionLine = {
  stockId: string;
  itemName: string;
  unit: string;
  requestedQuantity: number;
  notes: string;
};

export type EmployeeRequisition = {
  id: string;
  code: string;
  status: string;
  projectName: string;
  neededBy: string | null;
  notes: string | null;
  createdAt: string;
  lines: Array<{
    itemName: string;
    quantity: number;
    unit: string;
    approvedQuantity: number | null;
    dispatchedQuantity: number;
  }>;
};

export type EmployeeProject = {
  id: string;
  label: string;
};

export type EmployeePortalData = {
  employeeId: string;
  employeeName: string;
  signatureDataUrl: string | null;
  companyId: string;
  projects: EmployeeProject[];
  stockItems: EmployeeStockItem[];
  requisitions: EmployeeRequisition[];
};

// ─── Carga de datos ──────────────────────────────────────────

export async function loadEmployeePortalData(): Promise<EmployeePortalData | null> {
  const supabase = client();
  if (!supabase) return null;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  // Vincular empleado
  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, company_id")
    .eq("profile_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!employee) return null;

  const companyId = employee.company_id as string;

  // Cargar en paralelo
  const [projectsResult, stockResult, reqResult, signatureResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, code, name")
      .eq("company_id", companyId)
      .in("status", ["pending", "active"])
      .order("name"),
    supabase
      .from("inventory_stock")
      .select("id, quantity, reserved_quantity, unit_cost, item:inventory_items(name, unit, category)")
      .eq("company_id", companyId)
      .gt("quantity", 0),
    supabase
      .from("inventory_requisitions")
      .select(
        "id, code, status, needed_by, notes, created_at, " +
        "project:projects(name), " +
        "lines:inventory_requisition_lines(item_name_snapshot, requested_quantity, unit_snapshot, approved_quantity, dispatched_quantity)"
      )
      .eq("company_id", companyId)
      .eq("requested_by", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("my_signature"),
  ]);

  const projects: EmployeeProject[] = ((projectsResult.data ?? []) as Array<Record<string, unknown>>).map((p) => ({
    id: String(p.id),
    label: `${p.code} · ${p.name}`,
  }));

  const stockItems: EmployeeStockItem[] = ((stockResult.data ?? []) as Array<Record<string, unknown>>)
    .map((s) => {
      const item = (Array.isArray(s.item) ? s.item[0] : s.item) as { name?: string; unit?: string; category?: string } | null;
      const qty = Number(s.quantity ?? 0);
      const reserved = Number(s.reserved_quantity ?? 0);
      return {
        stockId: String(s.id),
        itemName: item?.name ?? "Sin nombre",
        unit: item?.unit ?? "und",
        available: Math.max(0, qty - reserved),
        category: item?.category ?? "",
      };
    })
    .filter((s) => s.available > 0)
    .sort((a, b) => a.itemName.localeCompare(b.itemName, "es-CO"));

  const requisitions: EmployeeRequisition[] = ((reqResult.data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
    const project = (Array.isArray(r.project) ? r.project[0] : r.project) as { name?: string } | null;
    const lines = (Array.isArray(r.lines) ? r.lines : []) as Array<Record<string, unknown>>;
    return {
      id: String(r.id),
      code: String(r.code),
      status: String(r.status),
      projectName: project?.name ?? "",
      neededBy: (r.needed_by as string) ?? null,
      notes: (r.notes as string) ?? null,
      createdAt: String(r.created_at),
      lines: lines.map((l) => ({
        itemName: String(l.item_name_snapshot),
        quantity: Number(l.requested_quantity),
        unit: String(l.unit_snapshot),
        approvedQuantity: l.approved_quantity != null ? Number(l.approved_quantity) : null,
        dispatchedQuantity: Number(l.dispatched_quantity ?? 0),
      })),
    };
  });

  return {
    employeeId: String(employee.id),
    employeeName: String(employee.full_name),
    signatureDataUrl: (signatureResult.data as string | null) ?? null,
    companyId,
    projects,
    stockItems,
    requisitions,
  };
}

// ─── Crear requisición ──────────────────────────────────────

export async function createEmployeeRequisition(input: {
  projectId: string;
  neededBy: string;
  notes: string;
  lines: Array<{ stockId: string; quantity: number; notes: string }>;
  signatureDataUrl: string;
}): Promise<{ id: string; code: string }> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const linesJson = input.lines.map((l) => ({
    stock_id: l.stockId,
    quantity: l.quantity,
    notes: l.notes,
  }));

  const { data, error } = await supabase.rpc("create_employee_requisition", {
    p_project_id: input.projectId || null,
    p_needed_by: input.neededBy || null,
    p_notes: input.notes || null,
    p_lines: linesJson,
    p_signature_data_url: input.signatureDataUrl || null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/firmar/i.test(msg)) throw new Error("Debes firmar la solicitud para poder enviarla.");
    if (/material/i.test(msg) || /artículo/i.test(msg)) throw new Error(msg);
    throw new Error(msg || "No fue posible crear la solicitud.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    id: String(row?.requisition_id ?? ""),
    code: String(row?.requisition_code ?? ""),
  };
}

// ─── Guardar firma ──────────────────────────────────────────

export async function saveMySignature(signatureDataUrl: string): Promise<void> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { error } = await supabase.rpc("save_my_signature", {
    p_signature_data_url: signatureDataUrl,
  });

  if (error) throw new Error(error.message || "No fue posible guardar la firma.");
}

// ─── Registro delegado ──────────────────────────────────────

export type DelegateColleague = {
  id: string;
  fullName: string;
  jobTitle: string;
};

export async function loadColleagues(): Promise<DelegateColleague[]> {
  const supabase = client();
  if (!supabase) return [];

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data: membership } = await supabase
    .from("user_roles")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.company_id) return [];

  // Excluir al propio empleado
  const { data: myEmployee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();

  const { data } = await supabase
    .from("employees")
    .select("id, full_name, job_title")
    .eq("company_id", membership.company_id as string)
    .eq("is_active", true)
    .order("full_name");

  return ((data ?? []) as Array<{ id: string; full_name: string; job_title: string | null }>)
    .filter((e) => e.id !== myEmployee?.id)
    .map((e) => ({
      id: e.id,
      fullName: e.full_name,
      jobTitle: e.job_title ?? "",
    }));
}

export async function registerDelegatedCheckIn(input: {
  targetEmployeeId: string;
  projectId: string;
  siteName: string;
  activityDescription: string;
}): Promise<void> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { error } = await supabase.rpc("register_delegated_check_in", {
    p_target_employee_id: input.targetEmployeeId,
    p_project_id: input.projectId || null,
    p_site_name: input.siteName,
    p_activity_description: input.activityDescription,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/compañero/i.test(msg)) throw new Error(msg);
    if (/autenticado/i.test(msg)) throw new Error("Tu sesión no está activa. Vuelve a iniciar sesión.");
    throw new Error(msg || "No fue posible registrar la actividad.");
  }
}
