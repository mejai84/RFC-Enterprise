/* ─────────────────────────────────────────────────────────────
 * Módulo APU – Repositorio de Catálogo de Transporte
 * Persistencia en Supabase con RLS multiempresa y respaldo local.
 * ───────────────────────────────────────────────────────────── */

import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import {
  defaultTransportCatalog,
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

const LOCAL_STORAGE_KEY = "rfc_apu_transport_items";

/**
 * Carga el catálogo local guardado en el navegador o las semillas predeterminadas.
 */
function getLocalCatalog(): TransportItem[] {
  if (typeof window === "undefined") return defaultTransportCatalog;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultTransportCatalog));
      return defaultTransportCatalog;
    }
    const parsed = JSON.parse(raw) as TransportItem[];
    return parsed.filter((item) => item.isActive !== false);
  } catch {
    return defaultTransportCatalog;
  }
}

function saveLocalCatalog(items: TransportItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* Ignorar fallos de cuota de almacenamiento */
  }
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
 * Consulta el catálogo de transporte desde Supabase o el respaldo local.
 */
export async function getTransportCatalog(): Promise<TransportCatalog> {
  const local = getLocalCatalog();

  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    return { items: local, source: "fallback", warning: "Supabase no está configurado; se utiliza el catálogo local." };
  }

  const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return {
      items: local,
      source: "fallback",
      warning: "Sesión no iniciada; usando catálogo local del dispositivo.",
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("user_roles")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .limit(1);

  const companyId = memberships?.[0]?.company_id;
  if (membershipError || !companyId) {
    return {
      items: local,
      source: "fallback",
      warning: "No se identificó la empresa de la sesión activa.",
    };
  }

  const { data, error } = await supabase
    .from("apu_transport_items")
    .select("id, company_id, code, name, category, category_label, unit, default_rate, capacity, description, is_active, created_at, updated_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  if (error || !data?.length) {
    return {
      items: local,
      source: "fallback",
      warning: error?.message || "La tabla de transporte aún no tiene registros en base de datos; usando respaldo local.",
    };
  }

  const remoteItems = (data as TransportRow[]).map(mapRow);
  saveLocalCatalog(remoteItems);
  return { items: remoteItems, source: "database" };
}

/**
 * Crea o actualiza un ítem de transporte en la BD y en almacenamiento local.
 */
export async function persistTransportItem(
  companyId: string | null,
  item: Omit<TransportItem, "createdAt" | "updatedAt"> & { id?: string }
): Promise<TransportItem> {
  const now = new Date().toISOString();
  const id = item.id || crypto.randomUUID();
  const categoryLabel = transportCategoryLabels[item.category] || "Transporte";

  const resolvedItem: TransportItem = {
    ...item,
    id,
    categoryLabel,
    isActive: item.isActive !== false,
    updatedAt: now,
  };

  // Guardar siempre en local para disponibilidad inmediata
  const local = getLocalCatalog();
  const existingIdx = local.findIndex((i) => i.id === id);
  let updatedLocal: TransportItem[];
  if (existingIdx >= 0) {
    updatedLocal = [...local];
    updatedLocal[existingIdx] = resolvedItem;
  } else {
    updatedLocal = [resolvedItem, ...local];
  }
  saveLocalCatalog(updatedLocal);

  // Intentar persistir en Supabase si hay cliente y empresa activa
  if (isSupabaseConfigured && supabaseUrl && supabasePublishableKey && companyId) {
    try {
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      await supabase.from("apu_transport_items").upsert({
        id,
        company_id: companyId,
        code: resolvedItem.code,
        name: resolvedItem.name,
        category: resolvedItem.category,
        category_label: categoryLabel,
        unit: resolvedItem.unit,
        default_rate: resolvedItem.defaultRate,
        capacity: resolvedItem.capacity || "",
        description: resolvedItem.description || "",
        is_active: true,
        updated_at: now,
      }, { onConflict: "id" });
    } catch (err) {
      console.warn("Fallo persistiendo transporte en Supabase:", err);
    }
  }

  return resolvedItem;
}

/**
 * Elimina (o desactiva) un ítem de transporte.
 * No afecta en lo absoluto los APUs cerrados o históricos creados previamente.
 */
export async function removeTransportItem(
  companyId: string | null,
  itemId: string
): Promise<void> {
  const local = getLocalCatalog();
  const updatedLocal = local.filter((i) => i.id !== itemId);
  saveLocalCatalog(updatedLocal);

  if (isSupabaseConfigured && supabaseUrl && supabasePublishableKey && companyId) {
    try {
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      // Soft-delete para mantener integridad referencial histórica
      await supabase
        .from("apu_transport_items")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("company_id", companyId);
    } catch (err) {
      console.warn("Fallo desactivando transporte en Supabase:", err);
    }
  }
}
