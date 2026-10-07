"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

/**
 * Cambio de contraseña dentro de la misma pantalla.
 *
 * Antes era un enlace de texto que sacaba a otra página, y el flujo de recuperación
 * se mezclaba con el cambio. Aquí es un modal: se confirma o se cancela sin
 * perder lo que el usuario estaba viendo. Las reglas de contraseña son las mismas
 * que usa la página de restablecimiento.
 */
export function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSaving, onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    setError("");

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!currentPassword) { setError("Ingresa tu contraseña actual."); return; }
    if (password.length < 10 || !hasUpper || !hasLower || !hasDigit || !hasSymbol) {
      setError("La nueva contraseña debe tener mínimo 10 caracteres, con mayúsculas, minúsculas, números y caracteres especiales.");
      return;
    }
    if (password !== confirmation) { setError("La confirmación no coincide con la nueva contraseña."); return; }
    if (password === currentPassword) { setError("La nueva contraseña debe ser distinta de la actual."); return; }

    setIsSaving(true);
    try {
      const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
      const { error: updateError } = await supabase.auth.updateUser({ password, current_password: currentPassword });
      if (updateError) {
        setError("No fue posible cambiar la contraseña. Verifica que la actual sea correcta.");
        return;
      }
      setDone(true);
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
    } catch {
      setError("No fue posible cambiar la contraseña en este momento.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-change-title">
      <div className="modal-card password-change-modal">
        <div className="modal-header">
          <div>
            <p>Mi perfil</p>
            <h3 id="password-change-title">Cambiar contraseña</h3>
          </div>
          <button
            aria-label="Cerrar sin cambiar la contraseña"
            className="btn-close-modal"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {done ? (
          <>
            <p className="password-change-done" role="status">
              Contraseña actualizada. A partir de ahora usas la nueva para entrar.
            </p>
            <div className="modal-actions">
              <button className="inventory-action" onClick={onClose} type="button">Cerrar</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="password-change-field" htmlFor="current-password">
              Contraseña actual
              <input
                autoComplete="current-password"
                disabled={isSaving}
                id="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                ref={firstFieldRef}
                type="password"
                value={currentPassword}
              />
            </label>
            <label className="password-change-field" htmlFor="new-password">
              Nueva contraseña
              <input
                autoComplete="new-password"
                disabled={isSaving}
                id="new-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
              <small>Mínimo 10 caracteres, con mayúsculas, minúsculas, números y caracteres especiales.</small>
            </label>
            <label className="password-change-field" htmlFor="confirm-password">
              Repite la nueva contraseña
              <input
                autoComplete="new-password"
                disabled={isSaving}
                id="confirm-password"
                onChange={(event) => setConfirmation(event.target.value)}
                type="password"
                value={confirmation}
              />
            </label>

            {error ? (
              <p className="password-change-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="modal-actions">
              <button className="btn-cancel" disabled={isSaving} onClick={onClose} type="button">
                Cancelar
              </button>
              <button className="inventory-action" disabled={isSaving} type="submit">
                {isSaving ? "Guardando…" : "Guardar nueva contraseña"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

