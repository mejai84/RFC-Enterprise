"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { corePermissions } from "@/core/permissions";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

type DatabaseRole = { id: string; code: string; name: string };
type DatabasePermission = { id: string; code: string; description: string };
type Employee = {
  id: string;
  name: string;
  email: string;
  title: string;
  roleId: string;
  active: boolean;
  profileId: string | null;
  permissions: string[];
};
type Override = { employee_id: string; permission_id: string; mode: "grant" | "revoke" };
type InvitationStatus =
  | "not_invited"
  | "invited"
  | "active"
  | "disabled"
  | "orphaned"
  | "linked";

type InvitationStatusResponse = {
  status: InvitationStatus;
  email: string;
  profileId: string | null;
  invitedAt: string | null;
  confirmedAt: string | null;
  lastSignInAt: string | null;
  emailSent?: boolean;
  alreadyLinked?: boolean;
  warning?: string;
};

const invitationStatusLabels: Record<InvitationStatus, string> = {
  not_invited: "Sin invitar",
  invited: "Invitación enviada",
  active: "Cuenta activa",
  disabled: "Cuenta deshabilitada",
  orphaned: "Cuenta no encontrada",
  linked: "Cuenta vinculada",
};

function getErrorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

function formatInvitationDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type DetailTab = "ficha" | "cuenta" | "permisos";
type FilterMode = "all" | "active" | "inactive" | "uninvited";

export function EmployeesWorkspace() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<DatabaseRole[]>([]);
  const [basePermissionsByRole, setBasePermissionsByRole] = useState<Map<string, Set<string>>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [message, setMessage] = useState("Cargando directorio de personal…");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filtros y búsqueda del directorio
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("ficha");

  // Estado de invitación
  const [invitationStatus, setInvitationStatus] = useState<InvitationStatusResponse | null>(null);
  const [invitationMessage, setInvitationMessage] = useState("");
  const [isInvitationLoading, setIsInvitationLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Modales React
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

  const groupedPermissions = useMemo(() => {
    return Object.entries(
      corePermissions.reduce<Record<string, (typeof corePermissions)[number][]>>((groups, permission) => {
        (groups[permission.module] ??= []).push(permission);
        return groups;
      }, {})
    );
  }, []);

  const selected = employees.find((emp) => emp.id === selectedId) ?? employees[0] ?? null;

  const supabase = useMemo(() => {
    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
    return createBrowserClient(supabaseUrl, supabasePublishableKey);
  }, []);

  const loadEmployees = useCallback(async () => {
    await Promise.resolve();
    if (!supabase) {
      setMessage("Supabase no está configurado para esta aplicación.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setMessage("Inicia sesión con una cuenta administradora para gestionar personal y accesos.");
      setIsLoading(false);
      return;
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("user_roles")
      .select("company_id, branch_id, role_id")
      .eq("user_id", authData.user.id);
    if (membershipsError || !memberships?.length) {
      setMessage(getErrorMessage(membershipsError, "Tu cuenta no tiene una empresa asignada."));
      setIsLoading(false);
      return;
    }

    const currentCompanyId = memberships[0].company_id;
    const [
      { data: databaseRoles, error: rolesError },
      { data: databasePermissions, error: permissionsError },
      { data: rolePermissionRows, error: rolePermissionsError },
      { data: employeeRows, error: employeesError },
    ] = await Promise.all([
      supabase.from("roles").select("id, code, name"),
      supabase.from("permissions").select("id, code, description"),
      supabase.from("role_permissions").select("role_id, permission_id"),
      supabase
        .from("employees")
        .select("id, full_name, email, job_title, is_active, profile_id")
        .eq("company_id", currentCompanyId)
        .order("full_name"),
    ]);

    const loadError = rolesError || permissionsError || rolePermissionsError || employeesError;
    if (loadError) {
      setMessage(getErrorMessage(loadError, "No fue posible cargar el directorio de personal."));
      setIsLoading(false);
      return;
    }

    const roleRows = (databaseRoles ?? []) as DatabaseRole[];
    const permissions = (databasePermissions ?? []) as DatabasePermission[];
    const employeeIds = (employeeRows ?? []).map((emp) => emp.id);

    const [{ data: employeeRoleRows, error: employeeRolesError }, { data: overrideRows, error: overridesError }] =
      employeeIds.length
        ? await Promise.all([
            supabase.from("employee_roles").select("employee_id, role_id").in("employee_id", employeeIds),
            supabase
              .from("employee_permission_overrides")
              .select("employee_id, permission_id, mode")
              .in("employee_id", employeeIds),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

    if (employeeRolesError || overridesError) {
      setMessage(getErrorMessage(employeeRolesError || overridesError, "No fue posible cargar los permisos del directorio."));
      setIsLoading(false);
      return;
    }

    const permissionCodeById = new Map(permissions.map((p) => [p.id, p.code]));
    const basePermissionsByRole = new Map<string, Set<string>>();
    for (const item of rolePermissionRows ?? []) {
      const permissionCode = permissionCodeById.get(item.permission_id);
      if (!permissionCode) continue;
      const rolePerms = basePermissionsByRole.get(item.role_id) ?? new Set<string>();
      rolePerms.add(permissionCode);
      basePermissionsByRole.set(item.role_id, rolePerms);
    }

    const roleByEmployee = new Map((employeeRoleRows ?? []).map((item) => [item.employee_id, item.role_id]));
    const overridesByEmployee = new Map<string, Override[]>();
    for (const item of (overrideRows ?? []) as Override[]) {
      const values = overridesByEmployee.get(item.employee_id) ?? [];
      values.push(item);
      overridesByEmployee.set(item.employee_id, values);
    }

    const directory: Employee[] = (employeeRows ?? []).map((emp) => {
      const roleId = roleByEmployee.get(emp.id) ?? "";
      const effective = new Set(roleId ? (basePermissionsByRole.get(roleId) ?? []) : []);
      for (const override of overridesByEmployee.get(emp.id) ?? []) {
        const code = permissionCodeById.get(override.permission_id);
        if (!code) continue;
        if (override.mode === "grant") effective.add(code);
        else effective.delete(code);
      }
      return {
        id: emp.id,
        name: emp.full_name,
        email: emp.email,
        title: emp.job_title,
        roleId,
        active: emp.is_active,
        profileId: emp.profile_id,
        permissions: [...effective],
      };
    });

    const administratorRoleIds = new Set(
      roleRows.filter((r) => r.code === "administrator").map((r) => r.id)
    );
    setCompanyId(currentCompanyId);
    setBranchId(memberships[0].branch_id);
    setCanManage(memberships.some((m) => administratorRoleIds.has(m.role_id)));
    setRoles(roleRows);
    setBasePermissionsByRole(basePermissionsByRole);
    setEmployees(directory);
    setSelectedId((current) => (directory.some((e) => e.id === current) ? current : directory[0]?.id ?? null));
    setMessage(directory.length ? "" : "Aún no hay personal registrado.");
    setIsLoading(false);
  }, [supabase]);

  const loadInvitationStatus = useCallback(
    async (employeeId: string) => {
      await Promise.resolve();
      if (!supabase || !canManage) return;
      setIsInvitationLoading(true);
      setInvitationStatus(null);
      setInvitationMessage("");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setInvitationMessage("Tu sesión expiró. Inicia sesión nuevamente.");
          return;
        }
        const response = await fetch(
          `/api/employees/invitation-status?employeeId=${encodeURIComponent(employeeId)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        );
        const result = (await response.json().catch(() => ({}))) as
          | (InvitationStatusResponse & { error?: string })
          | { error?: string };
        if (!response.ok) {
          setInvitationMessage(String(result.error || "No fue posible consultar el estado de invitación."));
          return;
        }
        setInvitationStatus(result as InvitationStatusResponse);
      } catch {
        setInvitationMessage("No fue posible consultar el estado de invitación.");
      } finally {
        setIsInvitationLoading(false);
      }
    },
    [supabase, canManage]
  );

  useEffect(() => {
    void Promise.resolve().then(loadEmployees);
  }, [loadEmployees]);

  useEffect(() => {
    if (!canManage || !selected?.id) return;
    const employeeId = selected.id;
    void Promise.resolve().then(() => loadInvitationStatus(employeeId));
  }, [canManage, selected?.id, loadInvitationStatus]);

  // Filtrado y conteo de personal
  const filteredEmployees = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchesSearch =
        !term ||
        emp.name.toLowerCase().includes(term) ||
        emp.title.toLowerCase().includes(term) ||
        emp.email.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (filterMode === "active") return emp.active;
      if (filterMode === "inactive") return !emp.active;
      if (filterMode === "uninvited") return !emp.profileId;
      return true;
    });
  }, [employees, searchQuery, filterMode]);

  const counts = useMemo(() => {
    return {
      all: employees.length,
      active: employees.filter((e) => e.active).length,
      inactive: employees.filter((e) => !e.active).length,
      uninvited: employees.filter((e) => !e.profileId).length,
    };
  }, [employees]);

  // Acciones de negocio con RPCs atómicas de Etapa 1
  async function toggleActive() {
    if (!supabase || !selected || !canManage) return;
    const confirmText = selected.active
      ? `¿Estás seguro de desactivar la ficha de ${selected.name}? Se revocarán de inmediato todos sus accesos al sistema.`
      : `¿Deseas activar la ficha de ${selected.name}?`;
    if (!window.confirm(confirmText)) return;

    setIsSaving(true);
    setMessage("");

    // Intentar RPC atómica admin_toggle_employee_active
    const rpcResult = await supabase.rpc("admin_toggle_employee_active", {
      p_employee_id: selected.id,
    });

    if (rpcResult.error) {
      // Fallback si la RPC aún no fue migrada en el motor
      const { error: fallbackError } = await supabase
        .from("employees")
        .update({ is_active: !selected.active })
        .eq("id", selected.id);

      if (fallbackError) {
        setMessage(getErrorMessage(fallbackError, "No fue posible actualizar el estado."));
      } else {
        await loadEmployees();
        setMessage(selected.active ? "Empleado desactivado." : "Empleado activado.");
      }
    } else {
      await loadEmployees();
      setMessage(selected.active ? "Empleado desactivado y accesos revocados." : "Empleado activado exitosamente.");
    }
    setIsSaving(false);
  }

  async function changeRole(roleId: string) {
    if (!supabase || !selected || !canManage || !roleId || roleId === selected.roleId) return;
    setIsSaving(true);
    setMessage("");

    // Intentar RPC atómica admin_assign_employee_role
    const rpcResult = await supabase.rpc("admin_assign_employee_role", {
      p_employee_id: selected.id,
      p_role_id: roleId,
    });

    if (rpcResult.error) {
      // Si la RPC rechaza por último admin o error de validación
      if (rpcResult.error.message.includes("único administrador activo")) {
        window.alert(rpcResult.error.message);
        setIsSaving(false);
        return;
      }
      // Fallback transaccional en cliente
      if (selected.roleId) {
        await supabase.from("employee_roles").delete().eq("employee_id", selected.id);
      }
      const { error: insertError } = await supabase
        .from("employee_roles")
        .insert({ employee_id: selected.id, role_id: roleId });

      if (insertError) {
        setMessage(getErrorMessage(insertError, "No fue posible asignar el rol."));
      } else {
        await loadEmployees();
        setMessage("Rol actualizado.");
      }
    } else {
      await loadEmployees();
      setMessage("Rol base y membresía sincronizados atómicamente.");
    }
    setIsSaving(false);
  }

  async function togglePermission(code: string) {
    if (!supabase || !selected || !canManage) return;
    const permission = await supabase.from("permissions").select("id").eq("code", code).single();
    if (permission.error || !permission.data) {
      setMessage(getErrorMessage(permission.error, "No se encontró el permiso."));
      return;
    }
    const isBasePermission = basePermissionsByRole.get(selected.roleId)?.has(code) ?? false;
    const shouldHavePermission = !selected.permissions.includes(code);
    setIsSaving(true);
    let error: { message?: string } | null;
    if (shouldHavePermission === isBasePermission) {
      ({ error } = await supabase
        .from("employee_permission_overrides")
        .delete()
        .eq("employee_id", selected.id)
        .eq("permission_id", permission.data.id));
    } else {
      ({ error } = await supabase.from("employee_permission_overrides").upsert(
        { employee_id: selected.id, permission_id: permission.data.id, mode: shouldHavePermission ? "grant" : "revoke" },
        { onConflict: "employee_id,permission_id" }
      ));
    }
    if (error) setMessage(getErrorMessage(error, "No fue posible guardar la excepción de permiso."));
    else {
      await loadEmployees();
      setMessage("Excepción de permiso actualizada.");
    }
    setIsSaving(false);
  }

  async function sendPasswordReset() {
    if (!supabase || !selected || !canManage) return;
    setIsSaving(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMessage("Tu sesión expiró. Inicia sesión nuevamente.");
      setIsSaving(false);
      return;
    }
    const response = await fetch("/api/employees/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ employeeId: selected.id }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? `Enlace de recuperación enviado al correo ${selected.email}.`
        : String(result.error || "No fue posible enviar el enlace.")
    );
    setIsSaving(false);
  }

  async function inviteEmployee() {
    if (!supabase || !selected || !canManage || isInviting) return;
    setIsInviting(true);
    setInvitationMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setInvitationMessage("Tu sesión expiró. Inicia sesión nuevamente.");
        return;
      }
      const response = await fetch("/api/employees/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId: selected.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setInvitationMessage(String(result.error || "No fue posible enviar la invitación."));
        return;
      }
      setInvitationStatus(result as InvitationStatusResponse);
      const baseMessage = result.alreadyLinked
        ? "La ficha ya tiene una cuenta vinculada. Se sincronizó su membresía."
        : result.existingAccount
        ? "La cuenta existente se vinculó. Se envió un enlace para establecer la contraseña."
        : result.emailSent
        ? `Invitación enviada al buzón ${selected.email}.`
        : "La cuenta se vinculó, pero el correo no se pudo despachar.";
      setInvitationMessage([baseMessage, result.warning].filter(Boolean).join(" "));
      await loadEmployees();
      setMessage([baseMessage, result.warning].filter(Boolean).join(" "));
    } catch {
      setInvitationMessage("Error de conexión al enviar la invitación.");
    } finally {
      setIsInviting(false);
    }
  }

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
    const { error } = await supabase
      .from("employees")
      .update({
        full_name: editName.trim(),
        job_title: editTitle.trim(),
        email: editEmail.trim().toLowerCase(),
      })
      .eq("id", selected.id);

    if (error) setMessage(getErrorMessage(error, "No fue posible actualizar los datos laborales."));
    else {
      await loadEmployees();
      setMessage("Datos laborales actualizados exitosamente.");
      setShowEditModal(false);
    }
    setModalSaving(false);
  }

  async function submitPasswordModal() {
    if (!supabase || !selected) return;
    const hasUpper = /[A-Z]/.test(modalPassword);
    const hasLower = /[a-z]/.test(modalPassword);
    const hasDigit = /[0-9]/.test(modalPassword);
    const hasSymbol = /[^A-Za-z0-9]/.test(modalPassword);

    if (modalPassword.length < 10 || !hasUpper || !hasLower || !hasDigit || !hasSymbol) {
      window.alert("La contraseña debe tener mínimo 10 caracteres con mayúsculas, minúsculas, números y símbolos.");
      return;
    }
    if (modalPassword !== modalPasswordConfirm) {
      window.alert("Las contraseñas no coinciden.");
      return;
    }

    setModalSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/employees/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token ?? ""}` },
        body: JSON.stringify({ employeeId: selected.id, password: modalPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setModalPassword("");
        setModalPasswordConfirm("");
        setShowPasswordModal(false);
        const extra = result.accountCreated ? " Se creó su cuenta de acceso automáticamente." : "";
        setMessage(`Contraseña establecida para ${selected.name}.${extra}`);
      } else {
        window.alert(String(result.error || "No fue posible asignar la contraseña."));
      }
    } catch {
      window.alert("Error de red al comunicarse con el servidor.");
    } finally {
      setModalSaving(false);
    }
  }

  async function submitNewEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !companyId) {
      window.alert("No se identificó la empresa activa.");
      return;
    }
    if (!newEmpName.trim() || !newEmpEmail.trim() || !newEmpTitle.trim() || !newEmpRole) {
      window.alert("Completa todos los campos requeridos, incluyendo el rol base.");
      return;
    }
    setModalSaving(true);

    // Intentar creación atómica vía RPC
    const rpcResult = await supabase.rpc("admin_create_employee", {
      p_company_id: companyId,
      p_branch_id: branchId,
      p_full_name: newEmpName.trim(),
      p_email: newEmpEmail.trim().toLowerCase(),
      p_job_title: newEmpTitle.trim(),
      p_role_id: newEmpRole,
    });

    if (rpcResult.error) {
      // Fallback si RPC aún no está activa
      const { data: created, error: createError } = await supabase
        .from("employees")
        .insert({
          company_id: companyId,
          branch_id: branchId,
          full_name: newEmpName.trim(),
          email: newEmpEmail.trim().toLowerCase(),
          job_title: newEmpTitle.trim(),
        })
        .select("id")
        .single();

      if (createError || !created) {
        setMessage(getErrorMessage(createError, "No fue posible crear la ficha del empleado."));
        setModalSaving(false);
        return;
      }
      const { error: roleError } = await supabase
        .from("employee_roles")
        .insert({ employee_id: created.id, role_id: newEmpRole });

      if (roleError) {
        await supabase.from("employees").delete().eq("id", created.id);
        setMessage(getErrorMessage(roleError, "Error al asignar el rol inicial; el registro fue cancelado."));
        setModalSaving(false);
        return;
      }
      setSelectedId(created.id);
    } else {
      setSelectedId(rpcResult.data);
    }

    setShowNewEmployeeModal(false);
    setNewEmpName("");
    setNewEmpEmail("");
    setNewEmpTitle("");
    setNewEmpRole("");
    await loadEmployees();
    setMessage("Empleado y rol base creados de manera atómica.");
    setModalSaving(false);
  }

  const invitationBadgeStatus =
    invitationStatus?.status ?? (selected?.profileId ? "linked" : "not_invited");
  const invitationLabel = isInvitationLoading ? "Consultando…" : invitationStatusLabels[invitationBadgeStatus];

  const canInviteSelected = Boolean(
    canManage && selected?.active && selected.roleId && (!selected.profileId || invitationStatus?.status === "orphaned")
  );
  const canSyncSelected = Boolean(
    canManage && selected?.active && selected.roleId && selected.profileId && invitationStatus?.status !== "orphaned"
  );

  return (
    <main className="dashboard-content employees-page" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Administración · RFC Enterprise</p>
          <h1>Personal y accesos</h1>
          <small>Directorio de trabajadores, cuentas del portal, roles del sistema y matriz de permisos.</small>
        </div>
      </section>

      {message ? (
        <p className="employee-message" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <section className="employees-layout" style={{ gap: "20px" }}>
        {/* ── Directorio lateral ── */}
        <aside className="employees-list dashboard-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="panel-title" style={{ marginBottom: "4px" }}>
            <div>
              <p>Directorio</p>
              <h2>{employees.length} persona{employees.length === 1 ? "" : "s"}</h2>
            </div>
            <button
              className="emp-btn emp-btn--primary"
              disabled={!canManage || isSaving}
              onClick={() => setShowNewEmployeeModal(true)}
              type="button"
              style={{ padding: "6px 12px", fontSize: "0.8125rem" }}
            >
              + Nuevo
            </button>
          </div>

          {/* Búsqueda rápida */}
          <div>
            <input
              type="search"
              placeholder="Buscar por nombre, cargo o correo…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="emp-modal-input"
              style={{ fontSize: "0.8125rem", padding: "6px 10px" }}
            />
          </div>

          {/* Filtros de estado */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`btn-cancel ${filterMode === "all" ? "is-selected" : ""}`}
              style={{ fontSize: "0.6875rem", padding: "3px 8px", background: filterMode === "all" ? "#e0e7ff" : "transparent" }}
            >
              Todos ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("active")}
              className={`btn-cancel ${filterMode === "active" ? "is-selected" : ""}`}
              style={{ fontSize: "0.6875rem", padding: "3px 8px", background: filterMode === "active" ? "#e0e7ff" : "transparent" }}
            >
              Activos ({counts.active})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("inactive")}
              className={`btn-cancel ${filterMode === "inactive" ? "is-selected" : ""}`}
              style={{ fontSize: "0.6875rem", padding: "3px 8px", background: filterMode === "inactive" ? "#e0e7ff" : "transparent" }}
            >
              Inactivos ({counts.inactive})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("uninvited")}
              className={`btn-cancel ${filterMode === "uninvited" ? "is-selected" : ""}`}
              style={{ fontSize: "0.6875rem", padding: "3px 8px", background: filterMode === "uninvited" ? "#e0e7ff" : "transparent" }}
            >
              Sin cuenta ({counts.uninvited})
            </button>
          </div>

          {/* Listado de empleados */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", maxHeight: "calc(100vh - 340px)" }}>
            {isLoading ? (
              <p className="panel-intro">Cargando directorio…</p>
            ) : filteredEmployees.length === 0 ? (
              <p className="panel-intro" style={{ textAlign: "center", padding: "16px 0" }}>
                No se encontraron personas con ese filtro.
              </p>
            ) : (
              filteredEmployees.map((emp) => (
                <button
                  className={`employee-row ${emp.id === selected?.id ? "is-selected" : ""}`}
                  key={emp.id}
                  onClick={() => {
                    setSelectedId(emp.id);
                    setMessage("");
                  }}
                  type="button"
                  style={{ textAlign: "left" }}
                >
                  <span>
                    {emp.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <strong>
                    {emp.name}
                    <small>
                      {emp.title} · {emp.profileId ? "Con cuenta" : "Sin invitar"}
                    </small>
                  </strong>
                  {!emp.roleId ? (
                    <i style={{ color: "#b91c1c", fontWeight: 700 }}>⚠ Sin rol</i>
                  ) : (
                    <i className={emp.active ? "is-active" : ""}>
                      {emp.active ? "Activo" : "Inactivo"}
                    </i>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Panel de detalle con pestañas especializadas ── */}
        <div className="employees-main">
          {selected ? (
            <section className="dashboard-panel employee-permissions" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Encabezado del empleado seleccionado */}
              <div className="panel-title" style={{ borderBottom: "1px solid var(--color-border, #e2e8f0)", paddingBottom: "12px", alignItems: "center" }}>
                <div>
                  <p>Persona seleccionada</p>
                  <h2>{selected.name}</h2>
                  <small style={{ color: "var(--color-text-muted, #64748b)" }}>
                    {selected.title} · {selected.email}
                  </small>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      background: selected.active ? "#dcfce7" : "#fee2e2",
                      color: selected.active ? "#166534" : "#991b1b",
                    }}
                  >
                    {selected.active ? "Ficha activa" : "Ficha desactivada"}
                  </span>
                  <button
                    className="emp-btn emp-btn--outline"
                    disabled={!canManage || isSaving}
                    onClick={toggleActive}
                    type="button"
                  >
                    {selected.active ? "Desactivar ficha" : "Activar ficha"}
                  </button>
                </div>
              </div>

              {/* Selector de subpestañas */}
              <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--color-border, #e2e8f0)", paddingBottom: "8px" }}>
                <button
                  type="button"
                  onClick={() => setDetailTab("ficha")}
                  className={`btn-cancel ${detailTab === "ficha" ? "is-selected" : ""}`}
                  style={{
                    fontWeight: detailTab === "ficha" ? 700 : 500,
                    background: detailTab === "ficha" ? "var(--color-primary, #0f172a)" : "transparent",
                    color: detailTab === "ficha" ? "#ffffff" : "inherit",
                  }}
                >
                  📋 Ficha del empleado
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("cuenta")}
                  className={`btn-cancel ${detailTab === "cuenta" ? "is-selected" : ""}`}
                  style={{
                    fontWeight: detailTab === "cuenta" ? 700 : 500,
                    background: detailTab === "cuenta" ? "var(--color-primary, #0f172a)" : "transparent",
                    color: detailTab === "cuenta" ? "#ffffff" : "inherit",
                  }}
                >
                  🔑 Cuentas e invitaciones
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("permisos")}
                  className={`btn-cancel ${detailTab === "permisos" ? "is-selected" : ""}`}
                  style={{
                    fontWeight: detailTab === "permisos" ? 700 : 500,
                    background: detailTab === "permisos" ? "var(--color-primary, #0f172a)" : "transparent",
                    color: detailTab === "permisos" ? "#ffffff" : "inherit",
                  }}
                >
                  🛡️ Roles y permisos ({selected.permissions.length})
                </button>
              </div>

              {/* ── Subpestaña 1: Ficha del empleado ── */}
              {detailTab === "ficha" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                    <div style={{ background: "var(--color-bg-subtle, #f8fafc)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)" }}>
                      <small style={{ textTransform: "uppercase", fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-text-muted, #64748b)" }}>
                        Nombre completo
                      </small>
                      <strong style={{ display: "block", fontSize: "0.9375rem", marginTop: "2px" }}>
                        {selected.name}
                      </strong>
                    </div>

                    <div style={{ background: "var(--color-bg-subtle, #f8fafc)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)" }}>
                      <small style={{ textTransform: "uppercase", fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-text-muted, #64748b)" }}>
                        Oficio o cargo laboral
                      </small>
                      <strong style={{ display: "block", fontSize: "0.9375rem", marginTop: "2px" }}>
                        {selected.title}
                      </strong>
                    </div>

                    <div style={{ background: "var(--color-bg-subtle, #f8fafc)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)" }}>
                      <small style={{ textTransform: "uppercase", fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-text-muted, #64748b)" }}>
                        Correo electrónico laboral
                      </small>
                      <strong style={{ display: "block", fontSize: "0.9375rem", marginTop: "2px" }}>
                        {selected.email}
                      </strong>
                    </div>

                    <div style={{ background: "var(--color-bg-subtle, #f8fafc)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--color-border, #e2e8f0)" }}>
                      <small style={{ textTransform: "uppercase", fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-text-muted, #64748b)" }}>
                        Rol base en el sistema
                      </small>
                      <strong style={{ display: "block", fontSize: "0.9375rem", marginTop: "2px" }}>
                        {roles.find((r) => r.id === selected.roleId)?.name ?? "⚠ Sin rol base asignado"}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                    <button
                      className="emp-btn emp-btn--primary"
                      onClick={openEditModal}
                      disabled={!canManage || isSaving}
                      type="button"
                    >
                      ✏️ Editar datos laborales
                    </button>
                  </div>
                </div>
              )}

              {/* ── Subpestaña 2: Cuentas e invitaciones ── */}
              {detailTab === "cuenta" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <section className="employee-access-card" aria-label="Estado de invitación al portal">
                    <div className="employee-access-head">
                      <div>
                        <p>Acceso al portal</p>
                        <h3>Identidad y autenticación de acceso</h3>
                      </div>
                      <span className="employee-access-badge" data-status={invitationBadgeStatus}>
                        {invitationLabel}
                      </span>
                    </div>

                    <p className="employee-access-meta">
                      Correo de la cuenta: <strong>{selected.email}</strong>
                      {invitationStatus?.invitedAt ? (
                        <>
                          <br />
                          Invitación enviada: <strong>{formatInvitationDate(invitationStatus.invitedAt)}</strong>
                        </>
                      ) : null}
                      {invitationStatus?.confirmedAt ? (
                        <>
                          <br />
                          Correo confirmado: <strong>{formatInvitationDate(invitationStatus.confirmedAt)}</strong>
                        </>
                      ) : null}
                      {invitationStatus?.lastSignInAt ? (
                        <>
                          <br />
                          Último ingreso al portal: <strong>{formatInvitationDate(invitationStatus.lastSignInAt)}</strong>
                        </>
                      ) : null}
                      {!isInvitationLoading &&
                      invitationStatus &&
                      !invitationStatus.invitedAt &&
                      !invitationStatus.confirmedAt &&
                      !invitationStatus.lastSignInAt ? (
                        <>
                          <br />
                          {invitationStatus.profileId
                            ? "La cuenta está vinculada pero aún no registra inicios de sesión."
                            : "La ficha aún no tiene una identidad de acceso creada en Supabase Auth."}
                        </>
                      ) : null}
                    </p>

                    {invitationStatus?.status === "invited" ? (
                      <p className="employee-access-hint">
                        La invitación está pendiente. Si el correo no llegó, reenvía o genera un enlace de recuperación.
                      </p>
                    ) : null}
                    {!selected.active ? (
                      <p className="employee-access-hint" style={{ color: "#b91c1c" }}>
                        La ficha está desactivada. Debes activarla antes de enviar invitaciones o sincronizar.
                      </p>
                    ) : null}

                    <div className="employee-access-actions">
                      {canInviteSelected ? (
                        <button
                          className="emp-btn emp-btn--primary"
                          onClick={() => void inviteEmployee()}
                          disabled={!canManage || isInviting || isInvitationLoading}
                          type="button"
                        >
                          {isInviting
                            ? "Enviando invitación…"
                            : selected.profileId
                            ? "Volver a invitar"
                            : "Invitar por correo"}
                        </button>
                      ) : null}
                      {canSyncSelected ? (
                        <button
                          className="emp-btn emp-btn--secondary"
                          onClick={() => void inviteEmployee()}
                          disabled={!canManage || isInviting || isInvitationLoading}
                          type="button"
                        >
                          {isInviting ? "Sincronizando…" : "Sincronizar membresía"}
                        </button>
                      ) : null}
                      {canManage && selected.profileId && invitationStatus?.status !== "orphaned" ? (
                        <button
                          className="emp-btn emp-btn--outline"
                          onClick={() => void loadInvitationStatus(selected.id)}
                          disabled={!canManage || isInvitationLoading || isInviting}
                          type="button"
                        >
                          {isInvitationLoading ? "Consultando…" : "Actualizar estado"}
                        </button>
                      ) : null}
                      <button
                        className="emp-btn emp-btn--secondary"
                        onClick={() => {
                          setModalPassword("");
                          setModalPasswordConfirm("");
                          setShowPasswordModal(true);
                        }}
                        disabled={!canManage || isSaving}
                        type="button"
                      >
                        🔑 Asignar contraseña
                      </button>
                      <button
                        className="emp-btn emp-btn--outline"
                        onClick={() => void sendPasswordReset()}
                        disabled={!canManage || isSaving}
                        type="button"
                      >
                        📧 Enviar recuperación
                      </button>
                    </div>

                    {invitationMessage ? (
                      <p className="employee-access-message" role="status" aria-live="polite">
                        {invitationMessage}
                      </p>
                    ) : null}
                  </section>
                </div>
              )}

              {/* ── Subpestaña 3: Roles y permisos ── */}
              {detailTab === "permisos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {!selected.roleId && (
                    <div
                      style={{
                        background: "#fef2f2",
                        border: "1px solid #fca5a5",
                        color: "#991b1b",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        fontWeight: 600,
                      }}
                    >
                      ⚠ Este empleado no tiene rol asignado. Selecciona un rol base a continuación para habilitarlo en el ERP.
                    </div>
                  )}

                  <label className="employee-role-select">
                    Rol base de sistema
                    <select
                      value={selected.roleId}
                      disabled={!canManage || isSaving}
                      onChange={(event) => void changeRole(event.target.value)}
                    >
                      {!selected.roleId && <option value="">— Selecciona un rol base —</option>}
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <p className="panel-intro" style={{ margin: 0 }}>
                    El rol base provee los permisos iniciales recomendados. Las casillas permiten añadir excepciones específicas (grant) o revocar capacidades (revoke). Las modificaciones se aplican y auditan en tiempo real.
                  </p>

                  <div className="permission-groups">
                    {groupedPermissions.map(([moduleName, perms]) => (
                      <fieldset key={moduleName}>
                        <legend>{moduleName}</legend>
                        {perms.map((permission) => {
                          const isInherited = basePermissionsByRole.get(selected.roleId)?.has(permission.code) ?? false;
                          const isEffective = selected.permissions.includes(permission.code);
                          const isException = isInherited !== isEffective;

                          return (
                            <label key={permission.code} style={{ alignItems: "flex-start" }}>
                              <input
                                checked={isEffective}
                                disabled={!canManage || isSaving}
                                onChange={() => void togglePermission(permission.code)}
                                type="checkbox"
                              />
                              <span>
                                <strong>
                                  {permission.description}
                                  {isException ? (
                                    <em style={{ fontSize: "0.6875rem", color: isEffective ? "#166534" : "#b91c1c", marginLeft: "6px" }}>
                                      ({isEffective ? "Excepción concedida" : "Excepción revocada"})
                                    </em>
                                  ) : null}
                                </strong>
                                <small>{permission.code}</small>
                              </span>
                            </label>
                          );
                        })}
                      </fieldset>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="dashboard-panel">
              <p className="panel-intro">Crea o selecciona un empleado para gestionar su ficha y accesos.</p>
            </section>
          )}

          {!isLoading && !canManage ? (
            <p className="employee-message" role="status">
              Solo una cuenta administradora puede crear empleados o modificar sus accesos.
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Modal: Editar empleado ── */}
      {showEditModal && selected ? (
        <div className="emp-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="emp-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Editar datos laborales</h2>
            <p>Actualiza la información de {selected.name}</p>
            <label className="emp-modal-label">
              <span>Nombre completo</span>
              <input
                className="emp-modal-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </label>
            <label className="emp-modal-label">
              <span>Correo electrónico laboral</span>
              <input
                className="emp-modal-input"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                type="email"
                required
              />
            </label>
            <label className="emp-modal-label">
              <span>Cargo u oficio</span>
              <input
                className="emp-modal-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </label>
            <div className="emp-modal-actions">
              <button className="emp-btn emp-btn--outline" type="button" onClick={() => setShowEditModal(false)}>
                Cancelar
              </button>
              <button
                className="emp-btn emp-btn--primary"
                type="button"
                disabled={modalSaving}
                onClick={() => void submitEditModal()}
              >
                {modalSaving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal: Asignar contraseña ── */}
      {showPasswordModal && selected ? (
        <div className="emp-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="emp-modal" onClick={(event) => event.stopPropagation()}>
            <h2>🔑 Asignar contraseña</h2>
            <p>
              Nueva contraseña de acceso para <strong>{selected.name}</strong>
            </p>
            <small className="emp-modal-hint">
              Mínimo 10 caracteres, combinando mayúsculas, minúsculas, números y símbolos especiales.
            </small>
            <label className="emp-modal-label">
              <span>Nueva contraseña</span>
              <input
                className="emp-modal-input"
                value={modalPassword}
                onChange={(e) => setModalPassword(e.target.value)}
                type="password"
                minLength={10}
                required
                placeholder="Mínimo 10 caracteres"
              />
            </label>
            <label className="emp-modal-label">
              <span>Confirmar contraseña</span>
              <input
                className="emp-modal-input"
                value={modalPasswordConfirm}
                onChange={(e) => setModalPasswordConfirm(e.target.value)}
                type="password"
                minLength={10}
                required
                placeholder="Repite la contraseña"
              />
            </label>
            <div className="emp-modal-actions">
              <button className="emp-btn emp-btn--outline" type="button" onClick={() => setShowPasswordModal(false)}>
                Cancelar
              </button>
              <button
                className="emp-btn emp-btn--primary"
                type="button"
                disabled={modalSaving}
                onClick={() => void submitPasswordModal()}
              >
                {modalSaving ? "Guardando…" : "Guardar contraseña"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal: Nuevo empleado ── */}
      {showNewEmployeeModal ? (
        <div className="emp-modal-overlay" onClick={() => setShowNewEmployeeModal(false)}>
          <form className="emp-modal emp-modal--wide" onClick={(e) => e.stopPropagation()} onSubmit={submitNewEmployee}>
            <h2>Nuevo empleado</h2>
            <p>Registra la ficha laboral y asigna el rol base de acceso de forma atómica.</p>
            <div className="emp-modal-grid">
              <label className="emp-modal-label">
                <span>Nombre completo</span>
                <input
                  className="emp-modal-input"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  required
                  minLength={3}
                  placeholder="Carlos Rodríguez Gómez"
                />
              </label>
              <label className="emp-modal-label">
                <span>Correo electrónico</span>
                <input
                  className="emp-modal-input"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="carlos@representacionesfigueroa.com"
                />
              </label>
              <label className="emp-modal-label">
                <span>Cargo u oficio laboral</span>
                <input
                  className="emp-modal-input"
                  value={newEmpTitle}
                  onChange={(e) => setNewEmpTitle(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Supervisor de Obra"
                />
              </label>
              <label className="emp-modal-label">
                <span>Rol base de sistema</span>
                <select
                  className="emp-modal-input"
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  required
                >
                  <option value="">Selecciona un rol base</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="emp-modal-actions">
              <button className="emp-btn emp-btn--outline" type="button" onClick={() => setShowNewEmployeeModal(false)}>
                Cancelar
              </button>
              <button className="emp-btn emp-btn--primary" type="submit" disabled={modalSaving}>
                {modalSaving ? "Creando…" : "Crear empleado"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
