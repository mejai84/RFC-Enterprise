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
    const directory = (employeeRows ?? []).flatMap((employee) => {
      const roleId = roleByEmployee.get(employee.id);
      if (!roleId || !roleById.has(roleId)) return [];
      const effectivePermissions = new Set(basePermissionsByRole.get(roleId) ?? []);
      for (const override of overridesByEmployee.get(employee.id) ?? []) {
        const code = permissionCodeById.get(override.permission_id);
        if (!code) continue;
        if (override.mode === "grant") effectivePermissions.add(code);
        else effectivePermissions.delete(code);
      }
      return [{ id: employee.id, name: employee.full_name, email: employee.email, title: employee.job_title, roleId, active: employee.is_active, permissions: [...effectivePermissions] }];
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
    if (!supabase || !selected || !canManage || roleId === selected.roleId) return;
    setIsSaving(true);
    const { error } = await supabase.from("employee_roles").update({ role_id: roleId }).eq("employee_id", selected.id);
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

  useEffect(() => {
    const anchor = document.querySelector(".employee-role-select");
    if (!anchor || !selected) return;
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:16px 0";
    actions.innerHTML = '<button class="btn-row-action" type="button">Editar empleado</button><button class="btn-row-action" type="button">Cambiar contraseña</button><button class="btn-row-action" type="button">Enviar recuperación</button>';
    const [editButton, passwordButton, emailButton] = Array.from(actions.querySelectorAll("button"));
    editButton?.addEventListener("click", async () => {
      if (!supabase || !canManage) return;
      const full_name = window.prompt("Nombre completo", selected.name);
      const job_title = window.prompt("Cargo", selected.title);
      const email = window.prompt("Correo electrónico", selected.email);
      if (!full_name || !job_title || !email) return;
      const { error } = await supabase.from("employees").update({ full_name: full_name.trim(), job_title: job_title.trim(), email: email.trim().toLowerCase() }).eq("id", selected.id);
      if (error) setMessage(getErrorMessage(error, "No fue posible actualizar los datos.")); else { await loadEmployees(); setMessage("Datos del empleado actualizados."); }
    });
    passwordButton?.addEventListener("click", () => {
      if (!canManage) return;
      const modal = document.createElement("div");
      modal.style.cssText = "position:fixed;inset:0;z-index:1000;background:rgba(5,25,16,.45);display:grid;place-items:center;padding:20px";
      modal.innerHTML = `<form style="background:#fff;border-radius:16px;box-shadow:0 20px 60px #0004;max-width:420px;padding:26px;width:100%"><h2 style="margin:0 0 8px">Cambiar contraseña</h2><p style="margin:0 0 16px">Nueva contraseña para ${selected.name}</p><input name="password" minlength="8" placeholder="Nueva contraseña" required style="box-sizing:border-box;margin:6px 0;padding:12px;width:100%" type="password" /><input name="confirmation" minlength="8" placeholder="Confirmar contraseña" required style="box-sizing:border-box;margin:6px 0;padding:12px;width:100%" type="password" /><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button type="button" data-cancel="true">Cancelar</button><button type="submit">Guardar contraseña</button></div></form>`;
      const form = modal.querySelector("form")!;
      modal.querySelector("[data-cancel]")?.addEventListener("click", () => modal.remove());
      form.addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(form); const password = String(data.get("password")); if (password !== String(data.get("confirmation"))) { window.alert("Las contraseñas no coinciden."); return; } const { data: sessionData } = await supabase!.auth.getSession(); const response = await fetch("/api/employees/password-reset", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token ?? ""}` }, body: JSON.stringify({ employeeId: selected.id, password }) }); const result = await response.json().catch(() => ({})); setMessage(response.ok ? `Contraseña actualizada para ${selected.name}.` : String(result.error || "No fue posible guardar la contraseña.")); if (response.ok) modal.remove(); });
      document.body.append(modal);
    });
    emailButton?.addEventListener("click", () => void sendPasswordReset());
    anchor.before(actions);
    return () => actions.remove();
  }, [canManage, loadEmployees, selected, supabase]);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".employee-form");
    if (!form || form.dataset.modalified) return;
    form.dataset.modalified = "true";
    form.style.display = "none";
    const formPanel = form.closest(".dashboard-panel");
    const formTitle = formPanel?.querySelector("h2");
    if (formTitle) formTitle.textContent = "Administración del directorio";
    const headingNote = document.querySelector(".employees-page .dashboard-heading small") as HTMLElement | null;
    if (headingNote) headingNote.style.display = "none";
    const trigger = document.createElement("button");
    trigger.type = "button"; trigger.className = "inventory-action"; trigger.textContent = "Nuevo empleado";
    trigger.addEventListener("click", () => {
      const modal = document.createElement("div");
      modal.style.cssText = "position:fixed;inset:0;z-index:1000;background:#001b0d77;display:grid;place-items:center;padding:20px";
      const roleOptions = roles.map((role) => `<option value="${role.id}">${role.name}</option>`).join("");
      modal.innerHTML = `<form style="background:#fff;border-radius:16px;max-width:620px;padding:28px;width:100%"><h2>Nuevo empleado</h2><p>Registra su ficha y asigna el rol de acceso.</p><input name="name" placeholder="Nombre completo" required style="box-sizing:border-box;margin:6px 0;padding:12px;width:100%"/><input name="email" placeholder="Correo electrónico" required type="email" style="box-sizing:border-box;margin:6px 0;padding:12px;width:100%"/><input name="title" placeholder="Cargo" required style="box-sizing:border-box;margin:6px 0;padding:12px;width:100%"/><select name="role" required style="box-sizing:border-box;margin:6px 0;padding:12px;width:100%"><option value="">Selecciona un rol</option>${roleOptions}</select><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px"><button type="button" data-cancel="true">Cancelar</button><button type="submit">Guardar empleado</button></div></form>`;
      modal.querySelector("[data-cancel]")?.addEventListener("click", () => modal.remove());
      modal.querySelector("form")?.addEventListener("submit", async (event) => { event.preventDefault(); if (!supabase || !companyId) return; const data = new FormData(event.currentTarget as HTMLFormElement); const { data: created, error } = await supabase.from("employees").insert({ company_id: companyId, full_name: String(data.get("name")).trim(), email: String(data.get("email")).trim().toLowerCase(), job_title: String(data.get("title")).trim() }).select("id").single(); if (error || !created) { setMessage(getErrorMessage(error, "No fue posible crear el empleado.")); return; } const { error: roleError } = await supabase.from("employee_roles").insert({ employee_id: created.id, role_id: String(data.get("role")) }); if (roleError) { setMessage(getErrorMessage(roleError, "Empleado creado sin rol.")); return; } modal.remove(); await loadEmployees(); setSelectedId(created.id); setMessage("Empleado creado correctamente."); });
      document.body.append(modal);
    });
    form.before(trigger);
    return () => trigger.remove();
  }, [companyId, loadEmployees, roles, supabase]);

  return <main className="dashboard-content employees-page"><section className="dashboard-heading"><div><p>Administración · RFC Enterprise</p><h1>Empleados y permisos</h1><small>Las altas, los roles, los permisos y los estados se guardan directamente en Supabase.</small></div></section><section className="employees-layout"><aside className="employees-list dashboard-panel"><div className="panel-title"><div><p>Directorio</p><h2>{employees.length} empleado{employees.length === 1 ? "" : "s"}</h2></div></div>{isLoading ? <p className="panel-intro">Cargando directorio…</p> : employees.map((employee) => <button className={`employee-row ${employee.id === selected?.id ? "is-selected" : ""}`} key={employee.id} onClick={() => { setSelectedId(employee.id); setMessage(""); }} type="button"><span>{employee.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span><strong>{employee.name}<small>{employee.title}</small></strong><i className={employee.active ? "is-active" : ""}>{employee.active ? "Activo" : "Inactivo"}</i></button>)}</aside><div className="employees-main"><section className="dashboard-panel"><div className="panel-title"><div><p>Nuevo empleado</p><h2>Registrar ficha laboral</h2></div></div><form className="employee-form" onSubmit={createEmployee}><label>Nombre completo<input name="name" required minLength={3} disabled={!canManage || isSaving} /></label><label>Correo electrónico<input name="email" type="email" required disabled={!canManage || isSaving} /></label><label>Cargo<input name="title" required minLength={2} disabled={!canManage || isSaving} /></label><label>Rol base<select name="role" defaultValue="" disabled={!canManage || isSaving} required><option value="" disabled>Selecciona un rol</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><button className="inventory-action" disabled={!canManage || isSaving || !roles.length} type="submit">{isSaving ? "Guardando…" : "Crear empleado"}</button></form>{!isLoading && !canManage ? <p className="employee-message" role="status">Solo una cuenta administradora puede crear empleados o modificar accesos.</p> : null}</section>{selected ? <section className="dashboard-panel employee-permissions"><div className="panel-title"><div><p>Acceso de {selected.name}</p><h2>{selected.active ? "Cuenta activa" : "Cuenta desactivada"}</h2></div><button className="btn-row-action" disabled={!canManage || isSaving} onClick={toggleActive} type="button">{selected.active ? "Desactivar" : "Activar"}</button></div><label className="employee-role-select">Rol base<select value={selected.roleId} disabled={!canManage || isSaving} onChange={(event) => void changeRole(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><p className="panel-intro">El rol aporta permisos iniciales; las casillas agregan o retiran excepciones específicas y se guardan de inmediato.</p><div className="permission-groups">{groupedPermissions.map(([module, permissions]) => <fieldset key={module}><legend>{module}</legend>{permissions.map((permission) => <label key={permission.code}><input checked={selected.permissions.includes(permission.code)} disabled={!canManage || isSaving} onChange={() => void togglePermission(permission.code)} type="checkbox" /><span><strong>{permission.description}</strong><small>{permission.code}</small></span></label>)}</fieldset>)}</div></section> : <section className="dashboard-panel"><p className="panel-intro">Crea el primer empleado para configurar su acceso.</p></section>}{message ? <p className="employee-message" role="status">{message}</p> : null}</div></section></main>;
}
