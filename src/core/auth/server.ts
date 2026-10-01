import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function requireAuthenticatedUser() {
  if (!isSupabaseConfigured) {
    redirect("/login?error=auth_not_configured");
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      redirect("/login");
    }
    return data.user;
  } catch {
    redirect("/login");
  }
}

