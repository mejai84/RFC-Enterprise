"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { PasswordChangeModal } from "./password-change-modal";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

/**
 * Ficha personal de quien está autenticado.
 *
 * Va separada de la Configuración empresarial a propósito: el perfil lo necesita
 * cualquier persona y la empresa, nómina y documentos solo administración. Mezclar
 * ambos obligaba a mostrar al trabajador unos ajustes que no debe tocar.
 */
export function ProfileWorkspace() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
      setIsLoading(false);
      return;
    }
    const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          setError("Inicia sesión para ver tu perfil.");
          return;
        }
        const [{ data: profile }, { data: membership }] = await Promise.all([
          supabase.from("profiles").select("display_name, email").eq("id", auth.user.id).maybeSingle(),
          supabase.from("user_roles").select("role_id, roles(name)").eq("user_id", auth.user.id).limit(1),
        ]);
        setName(profile?.display_name ?? "");
        setEmail(profile?.email ?? auth.user.email ?? "");
        const linkedRole = Array.isArray(membership?.[0]?.roles) ? membership?.[0]?.roles[0] : membership?.[0]?.roles;
        setRoleName(linkedRole?.name ?? "");
      } catch {
        setError("No fue posible cargar tu perfil.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    setNotice("");
    setError("");
    if (!name.trim()) {
      setError("Escribe tu nombre completo.");
      return;
    }
    setIsSaving(true);
    try {
      const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sesión no disponible.");
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() })
        .eq("id", auth.user.id);
      if (profileError) throw profileError;
      if (email.trim() !== auth.user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw emailError;
        setNotice("Datos guardados. Revisa tu correo para confirmar el cambio de dirección.");
      } else {
        setNotice("Datos guardados.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar tus datos.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="dashboard-content settings-page" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Personal · RFC Enterprise</p>
          <h1>Mi perfil</h1>
          <small>Estos datos son tuyos y solo los ves tú.</small>
        </div>
      </section>

      {error ? (
        <p className="settings-notice" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="settings-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="settings-grid">
        <form className="dashboard-panel settings-card" onSubmit={save}>
          <h2>Datos personales</h2>
          <label>
            Nombre completo
            <input disabled={isLoading || isSaving} onChange={(e) => setName(e.target.value)} required value={name} />
          </label>
          <label>
            Correo electrónico
            <input
              disabled={isLoading || isSaving}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          {roleName ? (
            <p className="panel-intro">
              Tu rol en la empresa es <strong>{roleName}</strong>. Lo define administración; si no es
              el correcto, pídeles que lo ajusten.
            </p>
          ) : null}
          <button className="inventory-action" disabled={isLoading || isSaving} type="submit">
            {isSaving ? "Guardando…" : "Guardar mis datos"}
          </button>
          {/* El cambio de contraseña ocurre aquí mismo: antes era un enlace de
              texto que sacaba a otra pantalla y perdía el contexto. */}
          <button
            className="btn-cancel"
            onClick={() => setIsPasswordModalOpen(true)}
            type="button"
          >
            Cambiar mi contraseña
          </button>
        </form>
      </div>
      {isPasswordModalOpen ? (
        <PasswordChangeModal onClose={() => setIsPasswordModalOpen(false)} />
      ) : null}
    </main>
  );
}