import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  INVENTORY_IMPORT_MAX_ROWS,
  validateInventoryImportRawRows,
  type InventoryImportRawRow,
} from "@/modules/inventory/domain/inventory-import";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const MAX_BODY_BYTES = 3_000_000;
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

function text(value: unknown, maxLength = 5_000): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function normalizeRawRow(value: unknown, index: number): InventoryImportRawRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const rowNumber =
    typeof row.rowNumber === "number" &&
    Number.isInteger(row.rowNumber) &&
    row.rowNumber > 0
      ? row.rowNumber
      : index + 2;
  return {
    rowNumber,
    sku: text(row.sku),
    name: text(row.name),
    category: text(row.category),
    brand: text(row.brand),
    unit: text(row.unit),
    inventoryGroup: text(row.inventoryGroup),
    location: text(row.location),
    quantity: text(row.quantity),
    minimumQuantity: text(row.minimumQuantity),
    unitCost: text(row.unitCost),
    notes: text(row.notes),
    sourceRow: text(row.sourceRow),
  };
}

async function loadExistingSkus(
  admin: SupabaseClient,
  companyId: string,
): Promise<{ skus?: Set<string>; error?: string }> {
  const skus = new Set<string>();
  const pageSize = 1_000;
  for (let page = 0; page < 50; page += 1) {
    const from = page * pageSize;
    const { data, error } = await admin
      .from("inventory_items")
      .select("sku")
      .eq("company_id", companyId)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) return { error: error.message };
    for (const item of data ?? []) {
      if (typeof item.sku === "string" && item.sku.trim()) {
        skus.add(item.sku.trim());
      }
    }
    if (!data || data.length < pageSize) break;
  }
  return { skus };
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return NextResponse.json(
      { error: "La importación no está configurada en el servidor." },
      { status: 503 },
    );
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Sesión no válida o expirada." },
      { status: 401 },
    );
  }

  if (isRateLimited(`import:${userData.user.id}`)) {
    return NextResponse.json(
      { error: "Demasiadas importaciones. Espera unos minutos antes de reintentar." },
      { status: 429 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "El archivo de importación es demasiado grande." },
      { status: 413 },
    );
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "El archivo de importación es demasiado grande." },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "La solicitud de importación no es válida." },
      { status: 400 },
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "La solicitud de importación no es válida." },
      { status: 400 },
    );
  }
  const body = payload as Record<string, unknown>;
  const companyId = text(body.companyId, 64);
  const branchId = text(body.branchId, 64);
  const fileName = text(body.fileName, 200).split(/[\\/]/).pop() || "importacion.csv";
  if (!UUID_REGEX.test(companyId) || !UUID_REGEX.test(branchId)) {
    return NextResponse.json(
      { error: "La empresa o la sede de la importación no son válidas." },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "No hay filas para importar." },
      { status: 400 },
    );
  }
  if (body.rows.length > INVENTORY_IMPORT_MAX_ROWS) {
    return NextResponse.json(
      {
        error: `La importación supera el máximo de ${INVENTORY_IMPORT_MAX_ROWS} filas.`,
      },
      { status: 400 },
    );
  }

  const { data: memberships, error: membershipError } = await admin
    .from("user_roles")
    .select("company_id, branch_id, roles!inner(code)")
    .eq("user_id", userData.user.id)
    .eq("company_id", companyId)
    .eq("branch_id", branchId)
    .in("roles.code", ["administrator", "inventory_manager"]);
  if (membershipError) {
    return NextResponse.json(
      { error: "No fue posible validar tu membresía." },
      { status: 502 },
    );
  }
  if (!memberships?.length) {
    return NextResponse.json(
      {
        error:
          "Solo un administrador o encargado de inventario puede importar en esta sede.",
      },
      { status: 403 },
    );
  }

  const rawRows: InventoryImportRawRow[] = [];
  for (let index = 0; index < body.rows.length; index += 1) {
    const normalized = normalizeRawRow(body.rows[index], index);
    if (!normalized) {
      return NextResponse.json(
        { error: `La fila ${index + 2} no tiene un formato válido.` },
        { status: 400 },
      );
    }
    rawRows.push(normalized);
  }

  const existing = await loadExistingSkus(admin, companyId);
  if (existing.error || !existing.skus) {
    return NextResponse.json(
      { error: "No fue posible verificar los SKU existentes." },
      { status: 502 },
    );
  }

  const preview = validateInventoryImportRawRows(rawRows, {
    existingSkus: existing.skus,
    hasUnitCostColumn: true,
  });
  if (preview.fileError) {
    return NextResponse.json({ error: preview.fileError }, { status: 400 });
  }

  const validRows = preview.rows.filter((row) => row.errors.length === 0);
  if (!validRows.length) {
    return NextResponse.json(
      {
        error:
          "Ninguna fila es válida. Revisa el resumen de errores y corrige el archivo.",
        validationErrors: preview.rows
          .filter((row) => row.errors.length)
          .map((row) => ({
            rowNumber: row.rowNumber,
            sku: row.sku,
            errors: row.errors,
          })),
      },
      { status: 422 },
    );
  }

  // Las escrituras usan el JWT del usuario, no service_role: la RPC conserva
  // auth.uid(), la autorización de inventario y las políticas RLS.
  const userClient = createClient(supabaseUrl, publishableKey, {
    accessToken: async () => token,
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const failures: { rowNumber: number; sku: string; error: string }[] = [];
  let created = 0;
  const concurrency = 4;

  for (let start = 0; start < validRows.length; start += concurrency) {
    const batch = validRows.slice(start, start + concurrency);
    const results = await Promise.all(
      batch.map(async (row) => {
        const { error } = await userClient.rpc(
          "create_inventory_item_with_opening_balance",
          {
            p_company_id: companyId,
            p_branch_id: branchId,
            p_sku: row.sku,
            p_name: row.name,
            p_category: row.category ?? "",
            p_brand: row.brand ?? "",
            p_unit: row.unit,
            p_notes: row.notes ?? "",
            p_inventory_group: row.inventoryGroup,
            p_location: row.location ?? "",
            p_minimum_quantity: row.minimumQuantity,
            p_unit_cost: row.unitCost,
            p_quantity: row.quantity,
            p_purchase_unit: "",
            p_units_per_purchase: null,
            p_purchase_unit_cost: null,
            p_technical_reference: "",
            p_model: "",
            p_serial_number: "",
            p_acquired_at: null,
            p_warranty_until: null,
            p_asset_condition: "",
          },
        );
        return { row, error };
      }),
    );

    for (const result of results) {
      if (result.error) {
        failures.push({
          rowNumber: result.row.rowNumber,
          sku: result.row.sku,
          error: result.error.message,
        });
      } else {
        created += 1;
      }
    }
  }

  const batchId = randomUUID();
  const { error: auditError } = await admin.from("audit_logs").insert({
    company_id: companyId,
    branch_id: branchId,
    actor_id: userData.user.id,
    entity_type: "inventory_import",
    entity_id: batchId,
    action: "inventory_import_confirmed",
    after_data: {
      file_name: fileName,
      total_rows: preview.total,
      valid_rows: preview.valid,
      created,
      failed: failures.length,
      errors: failures.slice(0, 100),
    },
  });

  return NextResponse.json({
    ok: failures.length === 0,
    batchId,
    total: preview.total,
    created,
    failed: failures.length,
    failures,
    validationErrors: preview.rows
      .filter((row) => row.errors.length)
      .map((row) => ({
        rowNumber: row.rowNumber,
        sku: row.sku,
        errors: row.errors,
      })),
    auditWarning: auditError
      ? `La importación terminó, pero no se pudo registrar la auditoría: ${auditError.message}`
      : undefined,
  });
}
