/* ─────────────────────────────────────────────────────────────
 * Módulo APU – Repositorio del Catálogo de Transporte
 *
 * Fuente de verdad: public.apu_transport_items (Supabase, RLS
 * multiempresa). El localStorage `rfc_apu_transport_items` deja de ser
 * fuente de verdad: solo se lee una vez para importar ítems que aún no
 * existan en la empresa y se elimina después de una importación exitosa.
 * ───────────────────────────────────────────────────────────── */

import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import {
  transportCategoryLabels,
  type TransportCatalog,
  type TransportCategory,
  type TransportItem,
  type TransportUnit,
} from "../domain/transport";

type TransportRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  category: TransportCategory;
  category_label: string;
  unit: TransportUnit;
  default_rate: number;
  capacity: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SupabaseBrowserClient = NonNullable<ReturnType<typeof createBrowserClient>>;

const LEGACY_STORAGE_KEY = "rfc_apu_transport_items";
const TRANSPORT_UNITS: TransportUnit[] = ["viaje", "día", "mes", "hora", "km", "gl"];
const SELECT_COLUMNS =
  "id, company_id, code, name, category, category_label, unit, default_rate, capacity, description, is_active, created_at, updated_at";

function client(): SupabaseBrowserClient | null {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

function isUuid(value: string | undefined): boolean {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function mapRow(row: TransportRow): TransportItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    categoryLabel: row.category_label || transportCategoryLabels[row.category] || "Transporte",
    unit: row.unit,
    defaultRate: Number(row.default_rate),
    capacity: row.capacity,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lee el catálogo legado del navegador. No se usa como fuente de verdad:
 * solo alimenta la importación única hacia Supabase.
 */
function readLegacyCatalog(): TransportItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is TransportItem => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<TransportItem>;
      return (
        typeof item.code === "string" &&
        item.code.trim().length > 0 &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        Object.prototype.hasOwnProperty.call(transportCategoryLabels, item.category ?? "") &&
        TRANSPORT_UNITS.includes(item.unit as TransportUnit) &&
        Number.isFinite(Number(item.defaultRate)) &&
        item.isActive !== false
      );
    });
  } catch {
    return [];
  }
}

function clearLegacyCatalog(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Si el navegador bloquea el almacenamiento, la clave simplemente queda
    // inerte: ya no se consulta para operar.
  }
}

async function resolveCompanyId(supabase: SupabaseBrowserClient): Promise<string | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;
  const { data: memberships, error: membershipError } = await supabase
    .from("user_roles")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .limit(1);
  if (membershipError) return null;
  return memberships?.[0]?.company_id ?? null;
}

/**
 * Importa únicamente los códigos que no existen en la empresa. Nunca
 * sobrescribe un ítem que ya vive en Supabase y solo elimina la clave local
 * después de que la importación terminó sin errores.
 */
async function importLegacyCatalog(
  supabase: SupabaseBrowserClient,
  companyId: string,
  legacy: TransportItem[],
  existingCodes: Set<string>,
): Promise<{ imported: number; error?: string }> {
  // Se deduplica por código (sin distinguir mayúsculas): PostgREST no acepta
  // dos filas con la misma clave de conflicto en un mismo upsert.
  const byCode = new Map<string, { code: string; item: TransportItem }>();
  for (const item of legacy) {
    const code = item.code.trim();
    const key = code.toLocaleUpperCase("es-CO");
    if (code && !existingCodes.has(key)) byCode.set(key, { code, item });
  }

  const missing = [...byCode.values()].map(({ code, item }) => ({
    company_id: companyId,
    code,
    name: item.name,
    category: item.category,
    category_label: transportCategoryLabels[item.category] || "Transporte",
    unit: item.unit,
    default_rate: Math.max(0, Number(item.defaultRate) || 0),
    capacity: item.capacity || "",
    description: item.description || "",
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  if (!missing.length) return { imported: 0 };

  const { error } = await supabase
    .from("apu_transport_items")
    .upsert(missing, { onConflict: "company_id,code", ignoreDuplicates: true });
  if (error) return { imported: 0, error: error.message };
  return { imported: missing.length };
}

async function queryCatalog(
  supabase: SupabaseBrowserClient,
  companyId: string,
): Promise<{ items: TransportItem[]; error?: string }> {
  const { data, error } = await supabase
    .from("apu_transport_items")
    .select(SELECT_COLUMNS)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  if (error) return { items: [], error: error.message };
  return { items: (data as TransportRow[]).map(mapRow) };
}

/**
 * Consulta el catálogo persistido. Si la empresa aún no tiene filas, intenta
 * una importación única del catálogo legado del navegador. Sin Supabase o sin
 * sesión no se inventan datos locales: se devuelve un catálogo vacío con aviso.
 */
export async function getTransportCatalog(): Promise<TransportCatalog> {
  const supabase = client();
  if (!supabase) {
    return {
      items: [],
      source: "fallback",
      warning:
        "Supabase no está configurado. El catálogo de transporte requiere conexión para ser fuente de verdad.",
    };
  }

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) {
    return {
      items: [],
      source: "fallback",
      warning:
        "No se pudo identificar la empresa activa. Inicia sesión o revisa tu membresía para consultar el catálogo de transporte.",
    };
  }

  const initial = await queryCatalog(supabase, companyId);
  if (initial.error) {
    return {
      items: [],
      source: "fallback",
      warning: `No fue posible consultar el catálogo de transporte: ${initial.error}`,
    };
  }

  const legacy = readLegacyCatalog();
  if (legacy.length) {
    const existingCodes = new Set(
      initial.items.map((item) => item.code.trim().toLocaleUpperCase("es-CO")),
    );
    const imported = await importLegacyCatalog(supabase, companyId, legacy, existingCodes);
    if (imported.error) {
      return {
        items: initial.items,
        source: initial.items.length ? "database" : "fallback",
        warning: `El catálogo local no se pudo importar: ${imported.error}. Se conserva en este dispositivo hasta que la importación funcione.`,
      };
    }

    clearLegacyCatalog();
    if (imported.imported > 0) {
      const refreshed = await queryCatalog(supabase, companyId);
      if (refreshed.error) {
        return {
          items: initial.items,
          source: "database",
          warning: `Se importaron ${imported.imported} ítem(s), pero no se pudo refrescar la lista: ${refreshed.error}`,
        };
      }
      return { items: refreshed.items, source: "database" };
    }
  }

  return {
    items: initial.items,
    source: "database",
    warning: initial.items.length
      ? undefined
      : "Tu empresa aún no tiene ítems en el catálogo de transporte. Agrega el primero.",
  };
}

function buildRow(
  companyId: string,
  item: Omit<TransportItem, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  return {
    company_id: companyId,
    code: item.code.trim(),
    name: item.name.trim(),
    category: item.category,
    category_label: transportCategoryLabels[item.category] || "Transporte",
    unit: item.unit,
    default_rate: Math.max(0, Number(item.defaultRate) || 0),
    capacity: item.capacity?.trim() || "",
    description: item.description?.trim() || "",
    is_active: item.isActive !== false,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Crea o actualiza un ítem en Supabase. Si el id no es UUID (por ejemplo,
 * un ítem legado), se resuelve por la clave única (empresa, código) para no
 * enviar identificadores inválidos. Un fallo se propaga a la pantalla: ya no
 * se simula un guardado exitoso en localStorage.
 */
export async function persistTransportItem(
  companyId: string | null,
  item: Omit<TransportItem, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<TransportItem> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado: el ítem no se puede guardar.");
  if (!companyId) throw new Error("No se identificó la empresa activa: el ítem no se puede guardar.");
  if (!item.code.trim()) throw new Error("El código del transporte es obligatorio.");
  if (!item.name.trim()) throw new Error("El nombre del transporte es obligatorio.");
  if (!Number.isFinite(item.defaultRate) || item.defaultRate < 0) {
    throw new Error("La tarifa del transporte debe ser un número mayor o igual a cero.");
  }

  const row = buildRow(companyId, item);
  const validId = isUuid(item.id);
  const payload = validId ? { ...row, id: item.id } : row;
  const { data, error } = await supabase
    .from("apu_transport_items")
    .upsert(payload, { onConflict: validId ? "id" : "company_id,code" })
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw new Error(`No fue posible guardar el ítem de transporte: ${error.message}`);
  return mapRow(data as TransportRow);
}

/**
 * Desactiva un ítem (borrado lógico) para conservar la integridad de los APU
 * históricos. Un fallo se propaga; no se modifica el almacenamiento local.
 */
export async function removeTransportItem(
  companyId: string | null,
  itemId: string,
): Promise<void> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado: el ítem no se puede desactivar.");
  if (!companyId) throw new Error("No se identificó la empresa activa: el ítem no se puede desactivar.");

  const { error } = await supabase
    .from("apu_transport_items")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("company_id", companyId);
  if (error) throw new Error(`No fue posible desactivar el ítem de transporte: ${error.message}`);
}
