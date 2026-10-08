"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { accessibleModules, canAccessModule, defaultLandingPath, moduleGroups, navigationSections } from "@/core/permissions";
import { useEffectivePermissions } from "@/core/permissions/use-effective-permissions";
import { initialAdministrator } from "@/core/users";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createBrowserClient } from "@supabase/ssr";

type IconName = "grid" | "briefcase" | "building" | "boxes" | "arrows" | "checklist" | "chart" | "users" | "clock" | "logout" | "menu" | "bell" | "close" | "sidebar" | "settings";

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
    briefcase: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M2 13h20" />
        <path d="M12 13v2" />
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
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
    logout: (
      <>
        <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
        <path d="m14 8 4 4-4 4M18 12H9" />
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
    sidebar: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16M15 9l-3 3 3 3" />
      </>
    ),
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.8v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3L9 19l-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H5.6v-2.8h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L7 8.2l2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2.8V5a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
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
  { icon: "briefcase" as const, label: "Cotizaciones", href: "/quotes" },
  { icon: "checklist" as const, label: "APU", href: "/apu" },
  { icon: "building" as const, label: "Proyectos & Obras", href: "/projects" },
  { icon: "clock" as const, label: "Registro de jornada", href: "/attendance" },
  { icon: "briefcase" as const, label: "Alquiler rápido", href: "/rentals" },
  { icon: "boxes" as const, label: "Inventarios", href: "/inventory" },
  { icon: "arrows" as const, label: "Movimientos", href: "/movements" },
  { icon: "checklist" as const, label: "Conteos físicos", href: "/counts" },
  { icon: "chart" as const, label: "Informes", href: "/reports" },
  { icon: "users" as const, label: "Empleados", href: "/employees" },
  { icon: "users" as const, label: "Mi perfil", href: "/perfil" },
  { icon: "settings" as const, label: "Configuración", href: "/settings" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissions, isLoading: arePermissionsLoading } = useEffectivePermissions();
  // Mientras se resuelve no se oculta nada todavía: se espera, para que el menú
  // no aparezca completo y luego se retire medio.
  const allowedHrefs = permissions ? new Set(accessibleModules(permissions).map((module) => module.href)) : null;
  const isDenied = permissions !== null && !canAccessModule(pathname, permissions);
  const visibleNavigation = allowedHrefs
    ? navigation.filter(({ href }) => allowedHrefs.has(href))
    : navigation;
  const navigationByHref = Object.fromEntries(visibleNavigation.map((item) => [item.href, item])) as Record<
    string,
    (typeof navigation)[number]
  >;
  // Los bloques se calculan con la misma fuente de permisos; sin ellos, la barra
  // queda como estaba para no dejar el menu vacio mientras se consulta.
  const menuSections =
    permissions && permissions.length > 0 ? navigationSections(permissions).sections : [];
  // Módulos que no pertenecen a ningún bloque, como el resumen: van sueltos arriba.

  // Buscador de modulos y accesos. Ademas de los modulos, incluye secciones que
  // viven dentro de Configuracion (tablas salariales, propuesta, firma y empresa)
  // para llegar directo sin digitar "configuracion" y desplazarse.
  const [navSearchQuery, setNavSearchQuery] = useState("");
  const settingsAccess: Array<{ label: string; href: string; hint: string }> = [
    { label: "Tablas salariales", href: "/settings?tab=labor_rates", hint: "Configuración" },
    { label: "Propuesta", href: "/settings?tab=proposal", hint: "Configuración" },
    { label: "Firma y membrete", href: "/settings?tab=branding", hint: "Configuración" },
    { label: "Empresa y nómina", href: "/settings?tab=company", hint: "Configuración" },
  ];
  const normalizeSearch = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const searchResults = useMemo(() => {
    const term = normalizeSearch(navSearchQuery.trim());
    if (!term) return [];
    const modules = visibleNavigation
      .filter((item) => normalizeSearch(item.label).includes(term))
      .map((item) => ({ label: item.label, href: item.href, hint: "Módulo" }));
    const sections = settingsAccess
      .filter((item) => normalizeSearch(item.label).includes(term))
      .map((item) => ({ label: item.label, href: item.href, hint: item.hint }));
    return [...modules, ...sections];
  }, [navSearchQuery, visibleNavigation]);

  const menuLoose =
    permissions && permissions.length > 0 ? navigationSections(permissions).loose : ["/dashboard"];
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  function toggleGroup(id: string) {
    setCollapsedGroups((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        localStorage.setItem("rfc_nav_groups", JSON.stringify(next));
      } catch {
        // Preferencia solo temporal: si no hay almacenamiento, se aplica igual.
      }
      return next;
    });
  }

  /** El bloque de la página actual nunca se pliega: no se esconde lo que se usa. */
  function isGroupOpen(id: string, currentPath: string): boolean {
    if (collapsedGroups.includes(id)) return false;
    const group = moduleGroups.find((item) => item.id === id);
    if (group?.hrefs.some((href) => currentPath === href || currentPath.startsWith(`${href}/`))) return true;
    return true;
  }

  function renderNavItem(
    item: (typeof navigation)[number] | undefined,
    isActive: boolean,
  ) {
    if (!item) return null;
    return (
      <Link
        aria-current={isActive ? "page" : undefined}
        className={`dashboard-nav-item ${isActive ? "is-active" : ""}`}
        href={item.href}
        key={item.label}
        onClick={() => setIsMenuOpen(false)}
        title={isSidebarCollapsed ? item.label : undefined}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </Link>
    );
  }
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(initialAdministrator);
  const [currentRole, setCurrentRole] = useState("Usuario del portal");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // El menú de la cuenta se cierra al pulsar fuera, con Escape o al cambiar de ruta.
  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [pathname]);
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

  useEffect(() => {
    try {
      setIsSidebarCollapsed(localStorage.getItem("rfc_dashboard_sidebar_collapsed") === "true");
      try {
        const stored = localStorage.getItem("rfc_nav_groups");
        if (stored) setCollapsedGroups(JSON.parse(stored) as string[]);
      } catch {
        // Si el valor guardado no es valido, todos los bloques empiezan abiertos.
      }
    } catch {
      // La barra lateral permanece expandida si el almacenamiento no está disponible.
    }
  }, []);

  useEffect(() => {
    if (!isDenied || !permissions) return;
    const landing = defaultLandingPath(permissions);
    if (landing === pathname) return;
    // Escribir la URL no habilita nada: si el módulo no está permitido, la persona
    // se dirige a su propio punto de partida.
    window.location.replace(landing);
  }, [isDenied, permissions, pathname]);

  useEffect(() => {
    // Un trabajador operativo no debe caer en un resumen que no puede ver.
    if (arePermissionsLoading || !permissions) return;
    if (pathname === "/" && !canAccessModule("/dashboard", permissions)) {
      window.location.replace(defaultLandingPath(permissions));
    }
  }, [arePermissionsLoading, permissions, pathname]);

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      try { localStorage.setItem("rfc_dashboard_sidebar_collapsed", String(next)); } catch { /* Preferencia solo temporal. */ }
      return next;
    });
  }

  async function signOut() {
    setIsSigningOut(true);
    if (isSupabaseConfigured && supabaseUrl && supabasePublishableKey) {
      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
      await supabase.auth.signOut();
    }
    window.location.assign("/login");
  }

  return (
    <div className={`dashboard-shell ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
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
        <div className="dashboard-nav-search">
          <label className="dashboard-nav-search-label" htmlFor="nav-search-input">Buscar módulos</label>
          <input
            id="nav-search-input"
            type="search"
            placeholder="Buscar módulos…"
            value={navSearchQuery}
            onChange={(event) => setNavSearchQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
        <p className="dashboard-nav-label">Operación</p>
        <nav className="dashboard-nav" aria-label="Navegación del portal">
          {navSearchQuery.trim() ? (
            searchResults.length > 0 ? (
              <div className="dashboard-nav-results">
                {searchResults.map((result) => (
                  <Link
                    className="dashboard-nav-item"
                    href={result.href}
                    key={result.href}
                    onClick={() => { setIsMenuOpen(false); setNavSearchQuery(""); }}
                  >
                    <Icon name="grid" />
                    <span>
                      {result.label}
                      <small>{result.hint}</small>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="dashboard-nav-empty">Sin resultados</p>
            )
          ) : (
            <>
              {menuLoose.map((href) => renderNavItem(navigationByHref[href], pathname === href))}

              {menuSections.map((section) => {
                if (!section.label) {
                  return section.hrefs.map((href) => renderNavItem(navigationByHref[href], pathname === href));
                }
                const open = isGroupOpen(section.id!, pathname);
                return (
                  <div className="dashboard-nav-group" key={section.id}>
                    <button
                      aria-expanded={open}
                      className="dashboard-nav-group-label"
                      onClick={() => toggleGroup(section.id!)}
                      type="button"
                    >
                      <span>{section.label}</span>
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        {open ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}
                      </svg>
                    </button>
                    {open ? section.hrefs.map((href) => renderNavItem(navigationByHref[href], pathname === href)) : null}
                  </div>
                );
              })}
            </>
          )}
        </nav>
        {/*
          Antes el pie de la barra lateral repetia avatar, nombre, rol, cambio de
          contrasena y cierre de sesion. Todo eso ya vive en el menu de la cuenta,
          en el icono de perfil de la cabecera. Se quito para que la misma
          informacion no aparezca en dos sitios a la vez.
        */}
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
          <button
            className="dashboard-sidebar-toggle"
            aria-controls="portal-navigation"
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? "Mostrar barra lateral" : "Contraer barra lateral"}
            onClick={toggleSidebar}
            type="button"
          >
            <Icon name="sidebar" />
          </button>
          <div className="dashboard-company">
            <strong>RFC Enterprise</strong>
          </div>
          <div className="dashboard-top-actions">
            <Link aria-label="Ver alertas operativas" className="dashboard-notifications-link" data-tooltip="Ver alertas operativas" href="/dashboard#operational-alerts">
              <Icon name="bell" />
            </Link>
            <button className="dashboard-signout" aria-label="Cerrar sesión y cambiar de usuario" disabled={isSigningOut} onClick={() => void signOut()} type="button">
              <Icon name="logout" /><span>{isSigningOut ? "Saliendo…" : "Cerrar sesión"}</span>
            </button>
            {/* El ícono de perfil agrupa las acciones de la cuenta: antes había un
                botón de cerrar sesión suelto al lado y nada llevaba a «Mi perfil». */}
            <div className="dashboard-account" ref={accountMenuRef}>
              <button
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
                aria-label={`Menú de tu cuenta: ${currentUser.name}`}
                className="dashboard-avatar dashboard-avatar--button"
                onClick={() => setIsAccountMenuOpen((open) => !open)}
                type="button"
              >
                {initials}
              </button>
              {isAccountMenuOpen ? (
                <div aria-label="Acciones de la cuenta" className="dashboard-account-menu" role="menu">
                  <p className="dashboard-account-identity">
                    <strong>{currentUser.name}</strong>
                    <small>{currentRole}</small>
                  </p>
                  <Link
                    className="dashboard-account-item"
                    href="/perfil"
                    onClick={() => setIsAccountMenuOpen(false)}
                    role="menuitem"
                  >
                    <Icon name="users" />
                    <span>Mi perfil</span>
                  </Link>
                  <Link
                    className="dashboard-account-item"
                    href="/restablecer-contrasena?mode=change"
                    onClick={() => setIsAccountMenuOpen(false)}
                    role="menuitem"
                  >
                    <Icon name="settings" />
                    <span>Cambiar contraseña</span>
                  </Link>
                  <button
                    className="dashboard-account-item"
                    disabled={isSigningOut}
                    onClick={() => { setIsAccountMenuOpen(false); void signOut(); }}
                    role="menuitem"
                    type="button"
                  >
                    <Icon name="logout" />
                    <span>{isSigningOut ? "Saliendo…" : "Cerrar sesión"}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {isDenied ? (
          <main className="dashboard-content" id="main-content">
            <div className="access-denied dashboard-panel" role="alert">
              <h1>No tienes acceso a esta sección</h1>
              <p>
                Tu rol no incluye este módulo. Si necesitas trabajar ahí, pídele a administración
                que ajuste tus permisos.
              </p>
              <Link className="btn-primary" href={permissions ? defaultLandingPath(permissions) : "/attendance"}>
                Ir a mi sección principal
              </Link>
            </div>
          </main>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
