import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

let cached: SupabaseClient | null = null;

/**
 * Cliente de Supabase para el navegador, usando únicamente la llave publicable.
 * Se reutiliza la misma instancia en lugar de crear una por cada llamada.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  if (!cached) cached = createBrowserClient(supabaseUrl, supabasePublishableKey);
  return cached;
}
