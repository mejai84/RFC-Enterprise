"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

/**
 * Permisos efectivos de la persona autenticada.
 *
 * La única fuente es `my_effective_permissions()` en la base de datos: rol laboral
 * de `employee_roles`, con respaldo en `user_roles`, y encima las excepciones
 * individuales de `employee_permission_overrides`. El cliente no decide permisos:
 * solo los lee. Así el menú, las rutas y los datos coinciden siempre.
 *
 * `permissions` es `null` mientras se consulta. Durante ese estado conviene no
 * ocultar nada todavía y esperar a resolverlo, para no mostrar módulos que luego
 * desaparezcan.
 */
export function useEffectivePermissions() {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
      // Sin Supabase no hay permisos que resolver: se deja pasar para no dejar
      // la aplicación en blanco, y las RLS siguen siendo la barrera real.
      setPermissions([]);
      setIsConfigured(false);
      return;
    }
    void (async () => {
      try {
        const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
        const { data, error } = await supabase.rpc("my_effective_permissions");
        if (!active) return;
        if (error) {
          // Ante un fallo no se oculta el menú a ciegas: se registra y se deja
          // el acceso visible solo a la base de datos.
          console.error("No fue posible resolver los permisos efectivos:", error.message);
          setPermissions([]);
          return;
        }
        setPermissions(((data ?? []) as Array<{ code: string }>).map((row) => row.code));
      } catch {
        if (active) setPermissions([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { permissions, isLoading: permissions === null, isConfigured };
}