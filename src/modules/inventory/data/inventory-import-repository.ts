import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import type { InventoryImportRawRow } from "../domain/inventory-import";

export type InventoryImportContext = {
  companyId: string;
  branchId: string;
  companyName: string | null;
  branchName: string | null;
  existingSkus: string[];
};

export type InventoryImportCommitResponse = {
  ok?: boolean;
  batchId?: string;
  total?: number;
  created?: number;
  failed?: number;
  failures?: { rowNumber: number; sku: string; error: string }[];
  validationErrors?: { rowNumber: number; sku: string; errors: string[] }[];
  auditWarning?: string;
  error?: string;
};

export function createInventoryImportClient(): SupabaseClient | null {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    return null;
  }
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

export async function loadInventoryImportContext(
  supabase: SupabaseClient,
): Promise<{ context?: InventoryImportContext; error?: string }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return {
      error: "Inicia sesión con una cuenta administradora o encargada de inventario.",
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("user_roles")
    .select("company_id, branch_id, roles!inner(code)")
    .eq("user_id", authData.user.id)
    .in("roles.code", ["administrator", "inventory_manager"])
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { error: "No fue posible consultar tu membresía." };
  }
  if (!membership) {
    return {
      error:
        "Tu cuenta no tiene una sede con permiso de inventario. Solicita el rol administrador o encargado de inventario.",
    };
  }

  const companyId = membership.company_id as string;
  const branchId = membership.branch_id as string | null;
  if (!branchId) {
    return {
      error: "Tu membresía no tiene sede asignada. Solicita una sede antes de importar.",
    };
  }

  const [{ data: company }, { data: branch }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
    supabase.from("branches").select("name").eq("id", branchId).maybeSingle(),
  ]);

  const existingSkus: string[] = [];
  const pageSize = 1_000;
  for (let page = 0; page < 50; page += 1) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("inventory_items")
      .select("sku")
      .eq("company_id", companyId)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) {
      return { error: "No fue posible leer los SKU existentes del catálogo." };
    }
    for (const item of data ?? []) {
      if (typeof item.sku === "string" && item.sku.trim()) {
        existingSkus.push(item.sku.trim());
      }
    }
    if (!data || data.length < pageSize) break;
  }

  return {
    context: {
      companyId,
      branchId,
      companyName: typeof company?.name === "string" ? company.name : null,
      branchName: typeof branch?.name === "string" ? branch.name : null,
      existingSkus,
    },
  };
}

export async function commitInventoryImport(
  supabase: SupabaseClient,
  input: {
    context: InventoryImportContext;
    fileName: string;
    rows: InventoryImportRawRow[];
  },
): Promise<{ response?: InventoryImportCommitResponse; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  }

  const response = await fetch("/api/inventory/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      companyId: input.context.companyId,
      branchId: input.context.branchId,
      fileName: input.fileName,
      rows: input.rows,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as InventoryImportCommitResponse;
  if (!response.ok) {
    return {
      response: body,
      error: body.error || "No fue posible confirmar la importación.",
    };
  }
  return { response: body };
}
