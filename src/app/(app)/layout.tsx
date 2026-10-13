import Link from "next/link";
import { enabledModules } from "@/core/modules/catalog";
import { AppNav } from "./app-nav";

/** Shell compartido por las rutas internas de la aplicación (route group `(app)`). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">RF</span>Representaciones Figueroa</Link>
        <AppNav modules={enabledModules} />
      </aside>
      <div className="shell-main">
        <header className="topbar"><div><small>Empresa</small><strong>Representaciones Figueroa</strong></div><div className="user-badge"><div><small>Sesión de ejemplo</small><strong>Administrador</strong></div><span className="avatar">AD</span></div></header>
        {children}
      </div>
    </div>
  );
}
