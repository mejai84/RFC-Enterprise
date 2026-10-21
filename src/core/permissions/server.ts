import "server-only";

import { redirect } from "next/navigation";
import { defaultLandingPath } from "./module-access";
import { createClient } from "@/lib/supabase/server";

/**
 * Barrera de servidor para que los datos no se serialicen a una persona que no
 * tiene permiso para el módulo. La navegación lateral es solo una ayuda visual.
 */
export async function requireAnyEffectivePermission(allowedPermissions: readonly string[]) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data, error } = await supabase.rpc("my_effective_permissions");
  const permissions = error
    ? []
    : ((data ?? []) as Array<{ code: string }>).map((permission) => permission.code);

  if (!allowedPermissions.some((permission) => permissions.includes(permission))) {
    redirect(defaultLandingPath(permissions));
  }
}

