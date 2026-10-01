"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabaseUrl, supabasePublishableKey } from "@/lib/supabase/config";
import { createBrowserClient } from "@supabase/ssr";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "auth_not_configured") {
        setError("El servicio de autenticación no está disponible o no está configurado en este entorno.");
      }
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Ingresa tu correo y contraseña.");
      setPending(false);
      return;
    }

    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
      setError("El servicio de autenticación no está disponible o no está configurado en este entorno.");
      setPending(false);
      return;
    }

    try {
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Credenciales incorrectas. Verifica el correo y la contraseña."
            : authError.message || "No fue posible ingresar con esas credenciales."
        );
        setPending(false);
        return;
      }

      if (data.session) {
        const params = new URLSearchParams(window.location.search);
        const nextPath = params.get("next");
        const safeDestination = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
        window.location.href = safeDestination;
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Error de conexión al autenticar.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="form-field">
        Correo electrónico
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nombre@empresa.com"
          required
        />
      </label>
      <label className="form-field">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </label>
      <Link className="auth-password-link" href="/restablecer-contrasena">
        ¿Olvidaste tu contraseña?
      </Link>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
