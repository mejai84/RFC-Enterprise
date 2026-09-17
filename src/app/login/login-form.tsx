"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabaseUrl, supabasePublishableKey } from "@/lib/supabase/config";
import { createBrowserClient } from "@supabase/ssr";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      // Maqueta navegable de desarrollo
      window.location.href = "/dashboard";
      return;
    }

    try {
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error("Supabase Auth Error:", authError);
        setError(authError.message === "Invalid login credentials"
          ? "Credenciales incorrectas. Verifica el correo y la contraseña."
          : authError.message || "No fue posible ingresar con esas credenciales.");
        setPending(false);
        return;
      }

      if (data.session) {
        console.log("Sesión iniciada exitosamente:", data.user?.email);
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: unknown) {
      console.error("Unexpected login error:", err);
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
          defaultValue="jajl840316@gmail.com"
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
