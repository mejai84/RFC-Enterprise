"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

type Mode = "request" | "recovery" | "change";

export function PasswordRecoveryForm() {
  const [mode, setMode] = useState<Mode>("request");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabase = useMemo(() => isSupabaseConfigured && supabaseUrl && supabasePublishableKey ? createBrowserClient(supabaseUrl, supabasePublishableKey) : null, []);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("mode");
    if (value === "change" || value === "recovery") setMode(value);
  }, []);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email || !supabase) { setError("Ingresa un correo válido para continuar."); return; }
    setPending(true); setError(null); setMessage(null);
    const redirectTo = `${window.location.origin}/restablecer-contrasena?mode=recovery`;
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setPending(false);
    if (requestError) { setError("No fue posible solicitar el cambio. Inténtalo nuevamente."); return; }
    setMessage("Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setError("Supabase no está configurado."); return; }
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    const currentPassword = String(data.get("currentPassword") ?? "");
    if (password.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirmation) { setError("La confirmación no coincide con la nueva contraseña."); return; }
    if (mode === "change" && !currentPassword) { setError("Ingresa tu contraseña actual."); return; }
    setPending(true); setError(null); setMessage(null);
    const { error: updateError } = await supabase.auth.updateUser(mode === "change" ? { password, current_password: currentPassword } : { password });
    setPending(false);
    if (updateError) { setError(mode === "change" ? "No fue posible cambiar la contraseña. Verifica la clave actual." : "El enlace no es válido o expiró. Solicita uno nuevo."); return; }
    setMessage("Contraseña actualizada correctamente. Ya puedes continuar.");
  }

  if (mode === "request") return <>
    <p>Escribe tu correo y te enviaremos un enlace seguro para recuperar el acceso.</p>
    <form onSubmit={requestReset}><label className="form-field">Correo electrónico<input name="email" type="email" autoComplete="email" required /></label><button className="primary-button" disabled={pending} type="submit">{pending ? "Enviando…" : "Enviar enlace de recuperación"}</button></form>
    {message ? <p className="auth-success" role="status">{message}</p> : null}{error ? <p className="auth-error" role="alert">{error}</p> : null}
    <Link className="auth-password-link auth-password-link-centered" href="/login">Volver a iniciar sesión</Link>
  </>;

  const isChange = mode === "change";
  return <>
    <p>{isChange ? "Confirma tu clave actual y define una nueva contraseña." : "Define una nueva contraseña para recuperar el acceso."}</p>
    <form onSubmit={updatePassword}>
      {isChange ? <label className="form-field">Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" required /></label> : null}
      <label className="form-field">Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="form-field">Confirmar nueva contraseña<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="primary-button" disabled={pending} type="submit">{pending ? "Guardando…" : "Actualizar contraseña"}</button>
    </form>
    {message ? <p className="auth-success" role="status">{message}</p> : null}{error ? <p className="auth-error" role="alert">{error}</p> : null}
    <Link className="auth-password-link auth-password-link-centered" href={isChange ? "/dashboard" : "/login"}>{isChange ? "Volver al portal" : "Volver a iniciar sesión"}</Link>
  </>;
}
