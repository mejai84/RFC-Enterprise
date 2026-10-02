"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { corePermissions } from "@/core/permissions";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

type DatabaseRole = { id: string; code: string; name: string };
type DatabasePermission = { id: string; code: string; description: string };
type Employee = { id: string; name: string; email: string; title: string; roleId: string; active: boolean; permissions: string[] };
type Override = { employee_id: string; permission_id: string; mode: "grant" | "revoke" };

function getErrorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

export function EmployeesWorkspace() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<DatabaseRole[]>([]);
  const [basePermissionsByRole, setBasePermissionsByRole] = useState<Map<string, Set<string>>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [message, setMessage] = useState("Cargando empleados…");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [temporaryPasswordConfirmation, setTemporaryPasswordConfirmation] = useState("");

  const groupedPermissions = useMemo(() => Object.entries(corePermissions.reduce<Record<string, (typeof corePermissions)[number][]>>((groups, permission) => {
    (groups[permission.module] ??= []).push(permission);
    return groups;
  }, {})), []);
  const selected = employees.find((employee) => employee.id === selectedId) ?? employees[0] ?? null;
  const supabase = useMemo(() => {
    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
    return createBrowserClient(supabaseUrl, supabasePublishableKey);
  }, []);

  const loadEmployees = useCallback(async () => {
    if (!supabase) {
      setMessage("Supabase no está configurado para esta aplicación.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setMessage("Inicia sesión con una cuenta administradora para gestionar empleados.");
      setIsLoading(false);
      return;
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("user_roles")
      .select("company_id, role_id")
      .eq("user_id", authData.user.id);
    if (membershipsError || !memberships?.length) {
      setMessage(getErrorMessage(membershipsError, "Tu cuenta no tiene una empresa asignada."));
      setIsLoading(false);
      return;
    }

    const currentCompanyId = memberships[0].company_id;
    const [{ data: databaseRoles, error: rolesError }, { data: databasePermissions, error: permissionsError }, { data: rolePermissionRows, error: rolePermissionsError }, { data: employeeRows, error: employeesError }] = await Promise.all([
      supabase.from("roles").select("id, code, name"),
      supabase.from("permissions").select("id, code, description"),
      supabase.from("role_permissions").select("role_id, permission_id"),
      supabase.from("employees").select("id, full_name, email, job_title, is_active").eq("company_id", currentCompanyId).order("full_name"),
    ]);
    const loadError = rolesError || permissionsError || rolePermissionsError || employeesError;
    if (loadError) {
      setMessage(getErrorMessage(loadError, "No fue posible cargar el directorio."));
      setIsLoading(false);
      return;
    }

    const roleRows = (databaseRoles ?? []) as DatabaseRole[];
    const permissions = (databasePermissions ?? []) as DatabasePermission[];
    const employeeIds = (employeeRows ?? []).map((employee) => employee.id);
    const [{ data: employeeRoleRows, error: employeeRolesError }, { data: overrideRows, error: overridesError }] = employeeIds.length
      ? await Promise.all([
          supabase.from("employee_roles").select("employee_id, role_id").in("employee_id", employeeIds),
          supabase.from("employee_permission_overrides").select("employee_id, permission_id, mode").in("employee_id", employeeIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (employeeRolesError || overridesError) {
      setMessage(getErrorMessage(employeeRolesError || overridesError, "No fue posible cargar los permisos del directorio."));
      setIsLoading(false);
      return;
    }

    const roleById = new Map(roleRows.map((role) => [role.id, role]));
    const permissionCodeById = new Map(permissions.map((permission) => [permission.id, permission.code]));
    const basePermissionsByRole = new Map<string, Set<string>>();
    for (const item of rolePermissionRows ?? []) {
      const permissionCode = permissionCodeById.get(item.permission_id);
      if (!permissionCode) continue;
      const rolePermissions = basePermissionsByRole.get(item.role_id) ?? new Set<string>();
      rolePermissions.add(permissionCode);
      basePermissionsByRole.set(item.role_id, rolePermissions);
    }
    const roleByEmployee = new Map((employeeRoleRows ?? []).map((item) => [item.employee_id, item.role_id]));
    const overridesByEmployee = new Map<string, Override[]>();
    for (const item of (overrideRows ?? []) as Override[]) {
      const values = overridesByEmployee.get(item.employee_id) ?? [];
      values.push(item);
      overridesByEmployee.set(item.employee_id, values);
    }
    const directory = (employeeRows ?? []).map((employee) => {
      const roleId = roleByEmployee.get(employee.id) ?? "";
      const effectivePermissions = new Set(roleId ? (basePermissionsByRole.get(roleId) ?? []) : []);
      for (const override of overridesByEmployee.get(employee.id) ?? []) {
        const code = permissionCodeById.get(override.permission_id);
        if (!code) continue;
        if (override.mode === "grant") effectivePermissions.add(code);
        else effectivePermissions.delete(code);
      }
      return { id: employee.id, name: employee.full_name, email: employee.email, title: employee.job_title, roleId, active: employee.is_active, permissions: [...effectivePermissions] };
    });

    const administratorRoleIds = new Set(roleRows.filter((role) => role.code === "administrator").map((role) => role.id));
    setCompanyId(currentCompanyId);
    setCanManage(memberships.some((membership) => administratorRoleIds.has(membership.role_id)));
    setRoles(roleRows);
    setBasePermissionsByRole(basePermissionsByRole);
    setEmployees(directory);
    setSelectedId((current) => directory.some((employee) => employee.id === current) ? current : directory[0]?.id ?? null);
    setMessage(directory.length ? "" : "Aún no hay empleados registrados.");
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !companyId || !canManage) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const roleId = String(data.get("role"));
    setIsSaving(true);
    setMessage("");
    const { data: createdEmployee, error: createError } = await supabase.from("employees").insert({
      company_id: companyId,
      full_name: String(data.get("name")).trim(),
      email: String(data.get("email")).trim().toLowerCase(),
      job_title: String(data.get("title")).trim(),
    }).select("id").single();
    if (createError || !createdEmployee) {
      setMessage(getErrorMessage(createError, "No fue posible crear el empleado."));
      setIsSaving(false);
      return;
    }
    const { error: roleError } = await supabase.from("employee_roles").insert({ employee_id: createdEmployee.id, role_id: roleId });
    if (roleError) {
      await supabase.from("employees").delete().eq("id", createdEmployee.id);
      setMessage(getErrorMessage(roleError, "No fue posible asignar el rol; el registro se revirtió."));
      setIsSaving(false);
      return;
    }
    form.reset();
    await loadEmployees();
    setSelectedId(createdEmployee.id);
    setMessage("Empleado creado y guardado en la base de datos.");
    setIsSaving(false);
  }

  async function toggleActive() {
    if (!supabase || !selected || !canManage) return;
    setIsSaving(true);
    const { error } = await supabase.from("employees").update({ is_active: !selected.active }).eq("id", selected.id);
    if (error) setMessage(getErrorMessage(error, "No fue posible actualizar el estado."));
    else { await loadEmployees(); setMessage(selected.active ? "Empleado desactivado y guardado." : "Empleado activado y guardado."); }
    setIsSaving(false);
  }

  async function changeRole(roleId: string) {
    if (!supabase || !selected || !canManage || !roleId || roleId === selected.roleId) return;
    setIsSaving(true);
    // The PK is (employee_id, role_id) so we must delete the old row first
    if (selected.roleId) {
      await supabase.from("employee_roles").delete().eq("employee_id", selected.id);
    }
    const { error } = await supabase.from("employee_roles").insert({ employee_id: selected.id, role_id: roleId });
    if (error) { setMessage(getErrorMessage(error, "No fue posible cambiar el rol.")); setIsSaving(false); return; }
    await loadEmployees();
    setMessage("Rol actualizado y guardado.");
    setIsSaving(false);
  }

  async function togglePermission(code: string) {
    if (!supabase || !selected || !canManage) return;
    const permission = await supabase.from("permissions").select("id").eq("code", code).single();
    if (permission.error || !permission.data) { setMessage(getErrorMessage(permission.error, "No se encontró el permiso.")); return; }
    const isBasePermission = basePermissionsByRole.get(selected.roleId)?.has(code) ?? false;
    const shouldHavePermission = !selected.permissions.includes(code);
    setIsSaving(true);
    let error: { message?: string } | null;
    if (shouldHavePermission === isBasePermission) {
      ({ error } = await supabase.from("employee_permission_overrides").delete().eq("employee_id", selected.id).eq("permission_id", permission.data.id));
    } else {
      ({ error } = await supabase.from("employee_permission_overrides").upsert({ employee_id: selected.id, permission_id: permission.data.id, mode: shouldHavePermission ? "grant" : "revoke" }, { onConflict: "employee_id,permission_id" }));
    }
    if (error) setMessage(getErrorMessage(error, "No fue posible guardar el permiso."));
    else { await loadEmployees(); setMessage("Permiso actualizado y guardado."); }
    setIsSaving(false);
  }

  async function sendPasswordReset() {
    if (!supabase || !selected || !canManage) return;
    setIsSaving(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setMessage("Tu sesión expiró. Inicia sesión nuevamente."); setIsSaving(false); return; }
    const response = await fetch("/api/employees/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ employeeId: selected.id }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Enlace de recuperación enviado a ${selected.email}.` : String(result.error || "No fue posible enviar el enlace."));
    setIsSaving(false);
  }

  async function setEmployeePassword() {
    if (!supabase || !selected || !canManage) return;
    if (temporaryPassword.length < 8) { setMessage("La contraseña debe tener al menos 8 caracteres."); return; }
    if (temporaryPassword !== temporaryPasswordConfirmation) { setMessage("La confirmación de contraseña no coincide."); return; }
    setIsSaving(true); setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setMessage("Tu sesión expiró. Inicia sesión nuevamente."); setIsSaving(false); return; }
    const response = await fetch("/api/employees/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ employeeId: selected.id, password: temporaryPassword }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setTemporaryPassword(""); setTemporaryPasswordConfirmation(""); }
    setMessage(response.ok ? `Contraseña actualizada para ${selected.name}. Entrégasela por un canal seguro.` : String(result.error || "No fue posible establecer la contraseña."));
    setIsSaving(false);
  }

  /* ── Modales React (reemplazan los antiguos document.createElement) ── */
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNewEmployeeModal, setShowNewEmployeeModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [modalPassword, setModalPassword] = useState("");
  const [modalPasswordConfirm, setModalPasswordConfirm] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpTitle, setNewEmpTitle] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("");

  function openEditModal() {
    if (!selected || !canManage) return;
    setEditName(selected.name);
    setEditEmail(selected.email);
    setEditTitle(selected.title);
    setShowEditModal(true);
  }

  async function submitEditModal() {
    if (!supabase || !selected || !editName.trim() || !editEmail.trim() || !editTitle.trim()) return;
    setModalSaving(true);
    const { error } = await supabase.from("employees").update({ full_name: editName.trim(), job_title: editTitle.trim(), email: editEmail.trim().toLowerCase() }).eq("id", selected.id);
    if (error) setMessage(getErrorMessage(error, "No fue posible actualizar los datos."));
    else { await loadEmployees(); setMessage("Datos del empleado actualizados."); setShowEditModal(false); }
    setModalSaving(false);
  }

  async function submitPasswordModal() {
    if (!supabase || !selected) return;
    
    const hasUpper = /[A-Z]/.test(modalPassword);
    const hasLower = /[a-z]/.test(modalPassword);
    const hasDigit = /[0-9]/.test(modalPassword);
    const hasSymbol = /[^A-Za-z0-9]/.test(modalPassword);

    if (modalPassword.length < 10 || !hasUpper || !hasLower || !hasDigit || !hasSymbol) { 
      window.alert("La contraseña debe tener mínimo 10 caracteres, incluyendo letras mayúsculas, minúsculas, números y caracteres especiales."); 
      return; 
    }
    
    if (modalPassword !== modalPasswordConfirm) { window.alert("Las contraseñas no coinciden."); return; }
    
    setModalSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/employees/password-reset", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token ?? ""}` }, body: JSON.stringify({ employeeId: selected.id, password: modalPassword }) });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setModalPassword(""); setModalPasswordConfirm(""); setShowPasswordModal(false);
        const extra = result.accountCreated ? " Se creó su cuenta de acceso automáticamente." : "";
        setMessage(`Contraseña actualizada para ${selected.name}.${extra}`);
      } else {
        window.alert(String(result.error || "No fue posible guardar la contraseña."));
      }
    } catch (error) {
      window.alert("Error de red o conexión al intentar comunicarse con el servidor.");
    } finally {
      setModalSaving(false);
    }
  }

  async function submitNewEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !companyId) {
      window.alert("Error de conexión: No se pudo identificar la empresa o base de datos.");
      return;
    }
    if (!newEmpName.trim() || !newEmpEmail.trim() || !newEmpTitle.trim() || !newEmpRole) {
      window.alert("Por favor completa todos los campos del formulario, incluyendo el rol.");
      return;
    }
    setModalSaving(true);
    const { data: created, error } = await supabase.from("employees").insert({ company_id: companyId, full_name: newEmpName.trim(), email: newEmpEmail.trim().toLowerCase(), job_title: newEmpTitle.trim() }).select("id").single();
    if (error || !created) { setMessage(getErrorMessage(error, "No fue posible crear el empleado.")); setModalSaving(false); return; }
    const { error: roleError } = await supabase.from("employee_roles").insert({ employee_id: created.id, role_id: newEmpRole });
    if (roleError) { setMessage(getErrorMessage(roleError, "Empleado creado sin rol.")); setModalSaving(false); return; }
    setShowNewEmployeeModal(false);
    setNewEmpName(""); setNewEmpEmail(""); setNewEmpTitle(""); setNewEmpRole("");
    await loadEmployees();
    setSelectedId(created.id);
    setMessage("Empleado creado y guardado. Asígnale una contraseña para que pueda ingresar.");
    setModalSaving(false);
  }

  return (
    <main className="dashboard-content employees-page" id="main-content">
      <section className="dashboard-heading">
        <div><p>Administración · RFC Enterprise</p><h1>Empleados y permisos</h1></div>
      </section>

      <section className="employees-layout">
        {/* ── Lista de empleados ── */}
        <aside className="employees-list dashboard-panel">
          <div className="panel-title"><div><p>Directorio</p><h2>{employees.length} empleado{employees.length === 1 ? "" : "s"}</h2></div></div>
          {isLoading ? <p className="panel-intro">Cargando directorio…</p> : employees.map((employee) => (
            <button className={`employee-row ${employee.id === selected?.id ? "is-selected" : ""}`} key={employee.id} onClick={() => { setSelectedId(employee.id); setMessage(""); }} type="button">
              <span>{employee.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span>
              <strong>{employee.name}<small>{employee.title}</small></strong>
              {!employee.roleId ? (
                <i style={{ color: "#b91c1c", fontWeight: 700 }}>⚠ Sin rol</i>
              ) : (
                <i className={employee.active ? "is-active" : ""}>{employee.active ? "Activo" : "Inactivo"}</i>
              )}
            </button>
          ))}
          <button className="emp-btn emp-btn--primary" disabled={!canManage || isSaving} onClick={() => setShowNewEmployeeModal(true)} type="button">+ Nuevo empleado</button>
        </aside>

        {/* ── Panel de detalle ── */}
        <div className="employees-main">
          {selected ? (
            <section className="dashboard-panel employee-permissions">
              <div className="panel-title">
                <div><p>Acceso de {selected.name}</p><h2>{selected.active ? "Cuenta activa" : "Cuenta desactivada"}</h2></div>
                <button className="emp-btn emp-btn--outline" disabled={!canManage || isSaving} onClick={toggleActive} type="button">{selected.active ? "Desactivar" : "Activar"}</button>
              </div>

              {/* ── Acciones de empleado ── */}
              <div className="emp-actions-row">
                <button className="emp-btn emp-btn--secondary" onClick={openEditModal} disabled={!canManage || isSaving} type="button">✏️ Editar datos</button>
                <button className="emp-btn emp-btn--secondary" onClick={() => { setModalPassword(""); setModalPasswordConfirm(""); setShowPasswordModal(true); }} disabled={!canManage || isSaving} type="button">🔑 Cambiar contraseña</button>
                <button className="emp-btn emp-btn--outline" onClick={() => void sendPasswordReset()} disabled={!canManage || isSaving} type="button">📧 Enviar recuperación</button>
              </div>

              {!selected.roleId && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "12px 16px", borderRadius: "8px", marginBottom: "12px", fontWeight: 600 }}>⚠ Este empleado no tiene rol asignado. Selecciona uno a continuación para habilitarlo en el sistema.</div>
              )}
              <label className="employee-role-select">Rol base
                <select value={selected.roleId} disabled={!canManage || isSaving} onChange={(event) => void changeRole(event.target.value)}>
                  {!selected.roleId && <option value="">— Selecciona un rol —</option>}
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
              <p className="panel-intro">El rol aporta permisos iniciales; las casillas agregan o retiran excepciones específicas y se guardan de inmediato.</p>
              <div className="permission-groups">
                {groupedPermissions.map(([module, permissions]) => (
                  <fieldset key={module}>
                    <legend>{module}</legend>
                    {permissions.map((permission) => (
                      <label key={permission.code}>
                        <input checked={selected.permissions.includes(permission.code)} disabled={!canManage || isSaving} onChange={() => void togglePermission(permission.code)} type="checkbox" />
                        <span><strong>{permission.description}</strong><small>{permission.code}</small></span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            </section>
          ) : (
            <section className="dashboard-panel"><p className="panel-intro">Crea el primer empleado para configurar su acceso.</p></section>
          )}
          {!isLoading && !canManage ? <p className="employee-message" role="status">Solo una cuenta administradora puede crear empleados o modificar accesos.</p> : null}
          {message ? <p className="employee-message" role="status" aria-live="polite">{message}</p> : null}
        </div>
      </section>

      {/* ── Modal: Editar empleado ── */}
      {showEditModal && selected ? (
        <div className="emp-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="emp-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Editar empleado</h2>
            <p>Actualiza los datos de {selected.name}</p>
            <label className="emp-modal-label"><span>Nombre completo</span><input className="emp-modal-input" value={editName} onChange={(event) => setEditName(event.target.value)} required /></label>
            <label className="emp-modal-label"><span>Correo electrónico</span><input className="emp-modal-input" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} type="email" required /></label>
            <label className="emp-modal-label"><span>Cargo</span><input className="emp-modal-input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required /></label>
            <div className="emp-modal-actions">
              <button className="emp-btn emp-btn--outline" type="button" onClick={() => setShowEditModal(false)}>Cancelar</button>
              <button className="emp-btn emp-btn--primary" type="button" disabled={modalSaving} onClick={() => void submitEditModal()}>{modalSaving ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal: Cambiar contraseña ── */}
      {showPasswordModal && selected ? (
        <div className="emp-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="emp-modal" onClick={(event) => event.stopPropagation()}>
            <h2>🔑 Cambiar contraseña</h2>
            <p>Nueva contraseña para <strong>{selected.name}</strong></p>
            <small className="emp-modal-hint">Mínimo 10 caracteres, mayúsculas, minúsculas, números y un símbolo.</small>
            <label className="emp-modal-label"><span>Nueva contraseña</span><input className="emp-modal-input" value={modalPassword} onChange={(event) => setModalPassword(event.target.value)} type="password" minLength={10} required placeholder="Mínimo 10 caracteres" /></label>
            <label className="emp-modal-label"><span>Confirmar contraseña</span><input className="emp-modal-input" value={modalPasswordConfirm} onChange={(event) => setModalPasswordConfirm(event.target.value)} type="password" minLength={10} required placeholder="Repite la contraseña" /></label>
            <div className="emp-modal-actions">
              <button className="emp-btn emp-btn--outline" type="button" onClick={() => setShowPasswordModal(false)}>Cancelar</button>
              <button className="emp-btn emp-btn--primary" type="button" disabled={modalSaving} onClick={() => void submitPasswordModal()}>{modalSaving ? "Guardando…" : "Guardar contraseña"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal: Nuevo empleado ── */}
      {showNewEmployeeModal ? (
        <div className="emp-modal-overlay" onClick={() => setShowNewEmployeeModal(false)}>
          <form className="emp-modal emp-modal--wide" onClick={(event) => event.stopPropagation()} onSubmit={submitNewEmployee}>
            <h2>Nuevo empleado</h2>
            <p>Registra su ficha y asigna el rol de acceso al sistema.</p>
            <div className="emp-modal-grid">
              <label className="emp-modal-label"><span>Nombre completo</span><input className="emp-modal-input" value={newEmpName} onChange={(event) => setNewEmpName(event.target.value)} required minLength={3} placeholder="Juan Pérez García" /></label>
              <label className="emp-modal-label"><span>Correo electrónico</span><input className="emp-modal-input" value={newEmpEmail} onChange={(event) => setNewEmpEmail(event.target.value)} type="email" required placeholder="juan@empresa.com" /></label>
              <label className="emp-modal-label"><span>Cargo</span><input className="emp-modal-input" value={newEmpTitle} onChange={(event) => setNewEmpTitle(event.target.value)} required minLength={2} placeholder="Ingeniero residente" /></label>
              <label className="emp-modal-label"><span>Rol base</span>
                <select className="emp-modal-input" value={newEmpRole} onChange={(event) => setNewEmpRole(event.target.value)} required>
                  <option value="">Selecciona un rol</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
            </div>
            <div className="emp-modal-actions">
              <button className="emp-btn emp-btn--outline" type="button" onClick={() => setShowNewEmployeeModal(false)}>Cancelar</button>
              <button className="emp-btn emp-btn--primary" type="submit" disabled={modalSaving}>{modalSaving ? "Guardando…" : "Crear empleado"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
