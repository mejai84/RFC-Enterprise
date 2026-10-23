"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { PasswordChangeModal } from "./password-change-modal";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { moduleAccess } from "@/core/permissions/module-access";
import { avatarPath } from "@/core/users/avatar";
import { saveMySignature } from "@/core/users/data/employee-portal-repository";
import { EmployeeAvatar } from "@/core/users/presentation/employee-avatar";
import { SignatureCapture } from "@/shared/components/signature-capture";

/**
 * Ficha personal y de seguridad de quien está autenticado ("Mi cuenta").
 *
 * Muestra información personal, estado de credenciales y permisos efectivos en solo lectura.
 * Separada del centro de configuración empresarial para asegurar la privacidad del usuario.
 */
export function ProfileWorkspace() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [emailConfirmedAt, setEmailConfirmedAt] = useState<string | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [avatarPathValue, setAvatarPathValue] = useState("");
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [isSignatureSaving, setIsSignatureSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      await Promise.resolve();
      if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
        if (isMounted) setIsLoading(false);
        return;
      }
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (!auth.user) {
          setError("Inicia sesión para ver tu cuenta.");
          setIsLoading(false);
          return;
        }

        setEmailConfirmedAt(auth.user.email_confirmed_at ?? null);

        const [
          { data: profile },
          { data: membership },
          { data: employeeData },
          { data: permissionsData },
          { data: signatureData },
        ] = await Promise.all([
          supabase.from("profiles").select("display_name, email").eq("id", auth.user.id).maybeSingle(),
          supabase.from("user_roles").select("role_id, roles(name)").eq("user_id", auth.user.id).limit(1),
          supabase.from("employees").select("id, company_id, job_title, avatar_path, companies(name), branches(name)").eq("profile_id", auth.user.id).maybeSingle(),
          supabase.rpc("my_effective_permissions"),
          supabase.rpc("my_signature"),
        ]);

        setName(profile?.display_name ?? "");
        setEmail(profile?.email ?? auth.user.email ?? "");

        const linkedRole = Array.isArray(membership?.[0]?.roles) ? membership?.[0]?.roles[0] : membership?.[0]?.roles;
        setRoleName(linkedRole?.name ?? "Sin rol asignado");

        if (employeeData) {
          setEmployeeId(employeeData.id ?? "");
          setCompanyId(employeeData.company_id ?? "");
          setAvatarPathValue(employeeData.avatar_path ?? "");
          setSignatureDataUrl((signatureData as string | null) ?? "");
          setJobTitle(employeeData.job_title ?? "");
          const comp = Array.isArray(employeeData.companies) ? employeeData.companies[0] : employeeData.companies;
          const branch = Array.isArray(employeeData.branches) ? employeeData.branches[0] : employeeData.branches;
          setCompanyName(comp?.name ?? "");
          setBranchName(branch?.name ?? "");
        }

        if (Array.isArray(permissionsData)) {
          setEffectivePermissions(permissionsData.map((p: { code: string }) => p.code));
        }
      } catch {
        setError("No fue posible cargar la información de tu cuenta.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const avatarInput = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    if (!employeeId || !companyId || isAvatarSaving) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen válida para tu foto de perfil.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("La foto no puede superar 2 MB.");
      return;
    }
    setError("");
    setNotice("");
    setIsAvatarSaving(true);
    try {
      const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
      const path = avatarPath(companyId, employeeId, file.name);
      const { error: uploadError } = await supabase.storage
        .from("employee-avatars")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      const { error: saveError } = await supabase.rpc("set_my_avatar_path", { p_path: path });
      if (saveError) throw saveError;

      if (avatarPathValue) {
        await supabase.storage.from("employee-avatars").remove([avatarPathValue]);
      }
      setAvatarPathValue(path);
      setNotice("Foto de perfil actualizada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible actualizar tu foto.");
    } finally {
      setIsAvatarSaving(false);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!avatarPathValue || isAvatarSaving) return;
    setError("");
    setNotice("");
    setIsAvatarSaving(true);
    try {
      const supabase = createBrowserClient(supabaseUrl!, supabasePublishableKey!);
      const { error: clearError } = await supabase.rpc("clear_my_avatar_path");
      if (clearError) throw clearError;
      await supabase.storage.from("employee-avatars").remove([avatarPathValue]);
      setAvatarPathValue("");
      setNotice("Foto de perfil eliminada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible eliminar tu foto.");
    } finally {
      setIsAvatarSaving(false);
    }
  }

  async function saveSignature(signature: string) {
    if (!signature || isSignatureSaving) return;
    setError("");
    setNotice("");
    setIsSignatureSaving(true);
    try {
      await saveMySignature(signature);
      setSignatureDataUrl(signature);
      setNotice("Tu firma personal fue actualizada. Solo se usará en confirmaciones autorizadas.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar tu firma.");
    } finally {
      setIsSignatureSaving(false);
    }
  }

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

      if (email.trim().toLowerCase() !== (auth.user.email ?? "").toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
        if (emailError) throw emailError;
        setNotice("Datos guardados. Revisa tu correo electrónico para confirmar el cambio de dirección.");
      } else {
        setNotice("Información personal actualizada correctamente.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar tus datos.");
    } finally {
      setIsSaving(false);
    }
  }

  const authorizedModules = moduleAccess.filter((mod) =>
    mod.permissions.some((p) => effectivePermissions.includes(p))
  );

  return (
    <main className="dashboard-content settings-page" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Identidad y credenciales · RFC Enterprise</p>
          <h1>Mi cuenta</h1>
          <small>Consulta y administra tus datos personales, seguridad de acceso y permisos asignados.</small>
        </div>
      </section>

      {error ? (
        <p className="settings-notice is-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="settings-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="settings-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
        {/* Panel 1: Información Personal */}
        <form className="dashboard-panel settings-card" onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h2>Información personal</h2>
            <p className="panel-intro" style={{ margin: 0 }}>Datos identificativos visibles en tus operaciones y documentos.</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <EmployeeAvatar name={name || "Mi cuenta"} jobTitle={jobTitle} path={avatarPathValue} size={72} />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <strong style={{ fontSize: "0.9375rem" }}>Foto de perfil</strong>
              <small style={{ color: "var(--color-text-muted, #64748b)" }}>
                JPG o PNG, máximo 2 MB. Si no subes una, se usa un avatar según tu cargo.
              </small>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  className="btn-cancel"
                  disabled={isLoading || isAvatarSaving}
                  onClick={() => avatarInput.current?.click()}
                  type="button"
                >
                  {isAvatarSaving ? "Guardando…" : avatarPathValue ? "Cambiar foto" : "Subir foto"}
                </button>
                {avatarPathValue ? (
                  <button
                    className="btn-cancel"
                    disabled={isAvatarSaving}
                    onClick={() => void removeAvatar()}
                    type="button"
                  >
                    Quitar foto
                  </button>
                ) : null}
              </div>
              <input
                ref={avatarInput}
                accept="image/*"
                hidden
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
              />
            </div>
          </div>

          <label>
            Nombre completo
            <input
              disabled={isLoading || isSaving}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
              placeholder="Tu nombre y apellidos"
            />
          </label>

          <label>
            Correo electrónico de acceso
            <input
              disabled={isLoading || isSaving}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
            <small style={{ color: "var(--color-text-muted, #64748b)", display: "block", marginTop: "4px" }}>
              Si modificas el correo, recibirás un enlace de confirmación antes de que sea efectivo.
            </small>
          </label>

          <label>
            Cargo u oficio laboral
            <input
              disabled
              readOnly
              value={jobTitle || "No registrado en ficha de personal"}
              style={{ background: "var(--color-bg-subtle, #f8fafc)", cursor: "not-allowed" }}
            />
          </label>

          <label>
            Empresa y sede vinculada
            <input
              disabled
              readOnly
              value={companyName ? `${companyName}${branchName ? ` · ${branchName}` : ""}` : "Sede Principal"}
              style={{ background: "var(--color-bg-subtle, #f8fafc)", cursor: "not-allowed" }}
            />
          </label>

          <div style={{ marginTop: "auto", paddingTop: "8px" }}>
            <button className="inventory-action" disabled={isLoading || isSaving} type="submit" style={{ width: "100%" }}>
              {isSaving ? "Guardando cambios…" : "Guardar mis datos"}
            </button>
          </div>
        </form>

        <section className="dashboard-panel settings-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h2>Mi firma</h2>
            <p className="panel-intro" style={{ margin: 0 }}>
              Registra tu firma manuscrita para confirmaciones operativas autorizadas. No reemplaza tu identificación ni el acceso con contraseña.
            </p>
          </div>

          <div style={{ background: "var(--color-bg-subtle, #f8fafc)", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: "8px", padding: "14px 16px" }}>
            <strong style={{ display: "block", fontSize: "0.9375rem", marginBottom: "6px" }}>
              {signatureDataUrl ? "Firma registrada" : "Firma pendiente"}
            </strong>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-muted, #64748b)" }}>
              {signatureDataUrl
                ? "Puedes revisarla y reemplazarla si es necesario."
                : "Dibuja tu firma con el dedo, lápiz o mouse."}
            </p>
          </div>

          {signatureDataUrl ? (
            <div style={{ border: "1px solid var(--color-border, #e2e8f0)", borderRadius: "8px", background: "#fff", minHeight: "120px", padding: "12px" }}>
              {/* Data URL local: no aplica optimización de imágenes remotas. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signatureDataUrl} alt="Firma manuscrita registrada" style={{ display: "block", width: "100%", height: "112px", objectFit: "contain" }} />
            </div>
          ) : null}

          <SignatureCapture
            eyebrow="Firma personal"
            label="Registrar mi firma"
            value={signatureDataUrl}
            allowClear={false}
            onChange={(value) => void saveSignature(value)}
          />
          {isSignatureSaving ? <small style={{ color: "var(--color-text-muted, #64748b)" }}>Guardando firma…</small> : null}
        </section>

        {/* Panel 2: Seguridad y Credenciales */}
        <div className="dashboard-panel settings-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h2>Seguridad y credenciales</h2>
            <p className="panel-intro" style={{ margin: 0 }}>Gestión de contraseña y estado de autenticación en la plataforma.</p>
          </div>

          <div style={{ background: "var(--color-bg-subtle, #f8fafc)", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: "8px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Estado del correo</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  background: emailConfirmedAt ? "#dcfce7" : "#fef9c3",
                  color: emailConfirmedAt ? "#166534" : "#854d0e",
                }}
              >
                {emailConfirmedAt ? "Verificado" : "Pendiente de confirmación"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-muted, #64748b)" }}>
              Tu correo es la llave única para ingresar a RFC Enterprise y recibir notificaciones operativas.
            </p>
          </div>

          <div style={{ background: "var(--color-bg-subtle, #f8fafc)", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: "8px", padding: "14px 16px" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "0.9375rem" }}>Contraseña de acceso</h3>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.8125rem", color: "var(--color-text-muted, #64748b)" }}>
              Se recomienda cambiar periódicamente tu contraseña utilizando al menos 10 caracteres con mayúsculas, minúsculas, números y símbolos.
            </p>
            <button
              className="btn-cancel"
              onClick={() => setIsPasswordModalOpen(true)}
              type="button"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Cambiar mi contraseña
            </button>
          </div>

          <div style={{ marginTop: "auto" }}>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted, #64748b)", lineHeight: "1.4" }}>
              💡 Si sospechas de un acceso no autorizado a tu cuenta, actualiza de inmediato tu contraseña y notifica al área de sistemas o administración.
            </p>
          </div>
        </div>

        {/* Panel 3: Rol y Permisos Asignados */}
        <div className="dashboard-panel settings-card" style={{ display: "flex", flexDirection: "column", gap: "16px", gridColumn: "1 / -1" }}>
          <div>
            <h2>Rol y accesos autorizados</h2>
            <p className="panel-intro" style={{ margin: 0 }}>
              Tu perfil de autorización determina las áreas y operaciones habilitadas para tu usuario.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", background: "var(--color-bg-subtle, #f8fafc)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)" }}>
            <div>
              <small style={{ display: "block", textTransform: "uppercase", fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-text-muted, #64748b)" }}>
                Rol asignado
              </small>
              <strong style={{ fontSize: "1.125rem", color: "var(--color-primary, #0f172a)" }}>
                {roleName}
              </strong>
            </div>
            <div style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--color-text-muted, #64748b)" }}>
              Solo administradores pueden modificar roles y permisos.
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "0.9375rem", margin: "0 0 10px 0" }}>Módulos habilitados en la plataforma:</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {authorizedModules.length > 0 ? (
                authorizedModules.map((mod) => (
                  <span
                    key={mod.href}
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "var(--color-bg-surface, #ffffff)",
                      border: "1px solid var(--color-border, #cbd5e1)",
                      color: "var(--color-text, #334155)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                    {mod.label}
                  </span>
                ))
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted, #64748b)" }}>
                  Cargando módulos autorizados…
                </p>
              )}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-muted, #64748b)", borderTop: "1px solid var(--color-border, #e2e8f0)", paddingTop: "12px" }}>
            Si requieres acceso a un módulo adicional para tu labor, solicita el ajuste al responsable administrativo de tu sede.
          </p>
        </div>
      </div>

      {isPasswordModalOpen ? (
        <PasswordChangeModal onClose={() => setIsPasswordModalOpen(false)} />
      ) : null}
    </main>
  );
}