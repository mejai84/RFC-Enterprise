"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { initialAdministrator } from "@/core/users";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createBrowserClient } from "@supabase/ssr";

type IconName = "grid" | "building" | "boxes" | "arrows" | "checklist" | "chart" | "users" | "menu" | "bell" | "close";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    building: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 21v-4h6v4M8 7h.01M16 7h.01M12 7h.01M8 11h.01M16 11h.01M12 11h.01M8 15h.01M16 15h.01M12 15h.01" />
      </>
    ),
    boxes: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.3 7.7 7.7 4.5 7.7-4.5M12 12.2V21" />
      </>
    ),
    arrows: (
      <>
        <path d="M7 3 3 7l4 4M3 7h12a3 3 0 0 1 3 3v1" />
        <path d="m17 21 4-4-4-4M21 17H9a3 3 0 0 1-3-3v-1" />
      </>
    ),
    checklist: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="m8 9 1.5 1.5L12 7.8M13.5 9H17M8 15l1.5 1.5 2.5-2.7M13.5 15H17" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        <path d="m4 10 6-6 6 9 4-6" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c.5-3.4 2.4-5 5.5-5s5 1.6 5.5 5M16 5.5a3 3 0 0 1 0 5M17 15c2.1.1 3.5 1.8 3.8 5" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const navigation = [
  { icon: "grid" as const, label: "Resumen", href: "/dashboard" },
  { icon: "building" as const, label: "Proyectos & Obras", href: "/projects" },
  { icon: "boxes" as const, label: "Inventarios", href: "/inventory" },
  { icon: "arrows" as const, label: "Movimientos", href: "/movements" },
  { icon: "checklist" as const, label: "Conteos físicos", href: "/counts" },
  { icon: "chart" as const, label: "Informes", href: "/reports" },
  { icon: "users" as const, label: "Empleados", href: "/employees" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(initialAdministrator);
  const [currentRole, setCurrentRole] = useState("Usuario del portal");
  const initials = useMemo(() => currentUser.name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "RF", [currentUser.name]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return;
    const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
    let active = true;
    async function loadCurrentUser() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user || !active) return;
      const fallbackName = String(user.user_metadata.full_name || user.email || "Usuario del portal");
      const [{ data: profile }, { data: memberships }] = await Promise.all([
        supabase.from("profiles").select("display_name, email").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role_id").eq("user_id", user.id).limit(1),
      ]);
      let roleName = "Usuario del portal";
      const roleId = memberships?.[0]?.role_id;
      if (roleId) {
        const { data: role } = await supabase.from("roles").select("name").eq("id", roleId).maybeSingle();
        roleName = role?.name || roleName;
      }
      if (!active) return;
      setCurrentUser({ ...initialAdministrator, id: user.id, name: profile?.display_name || fallbackName, email: profile?.email || user.email || initialAdministrator.email });
      setCurrentRole(roleName);
    }
    void loadCurrentUser();
    return () => { active = false; };
  }, []);

  return (
    <div className="dashboard-shell">
      <button
        className={`dashboard-backdrop ${isMenuOpen ? "is-visible" : ""}`}
        aria-label="Cerrar navegación"
        onClick={() => setIsMenuOpen(false)}
        type="button"
      />
      <aside
        className={`dashboard-sidebar ${isMenuOpen ? "is-open" : ""}`}
        id="portal-navigation"
      >
        <div className="dashboard-sidebar-header">
          <Link
            className="dashboard-brand"
            href="/"
            onClick={() => setIsMenuOpen(false)}
          >
            <Image
              src="/rfc-logo.svg"
              alt="RFC"
              width={36}
              height={36}
              priority
            />
            <span>
              RFC<small>Enterprise</small>
            </span>
          </Link>
          <button
            className="dashboard-close"
            aria-label="Cerrar navegación"
            onClick={() => setIsMenuOpen(false)}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="dashboard-nav-label">Operación</p>
        <nav className="dashboard-nav" aria-label="Navegación del portal">
          {navigation.map(({ icon, label, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`dashboard-nav-item ${isActive ? "is-active" : ""}`}
                href={href}
                key={label}
                onClick={() => setIsMenuOpen(false)}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="dashboard-sidebar-note">
          <span aria-hidden="true" />
          Catálogo de inventario disponible
        </div>
        <div className="dashboard-sidebar-footer">
          <div className="dashboard-avatar">{initials}</div>
          <div>
            <strong>{currentUser.name}</strong>
            <small>{currentRole}</small>
          </div>
        </div>
      </aside>
      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <button
            className="dashboard-menu"
            aria-controls="portal-navigation"
            aria-expanded={isMenuOpen}
            aria-label="Abrir navegación"
            onClick={() => setIsMenuOpen(true)}
            type="button"
          >
            <Icon name="menu" />
          </button>
          <div className="dashboard-company">
            <strong>RFC Enterprise</strong>
            <span>
              <i aria-hidden="true" />
              Datos de inventario disponibles
            </span>
          </div>
          <div className="dashboard-top-actions">
            <button aria-label="Sin notificaciones pendientes" type="button">
              <Icon name="bell" />
            </button>
            <div className="dashboard-avatar" aria-label={`Usuario: ${currentUser.name}`}>
              {initials}
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
