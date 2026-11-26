import { NavLink, Outlet } from "react-router";
import type { UserRole } from "@harmonylens/shared";
import { useAuth } from "../auth/useAuth";
import { ACCESS, ROLE_LABEL, can } from "../lib/roles";
import { Button } from "./ui";

interface NavItem {
  to: string;
  label: string;
  allowed: readonly UserRole[] | "all" | "admin";
}

const NAV: NavItem[] = [
  { to: "/", label: "Inicio", allowed: "all" },
  { to: "/autorizacion", label: "Autorizar lotes", allowed: ACCESS.authorize },
  { to: "/inventario", label: "Inventario", allowed: ACCESS.inventory },
  { to: "/importaciones", label: "Importaciones", allowed: ACCESS.imports },
  { to: "/referencias", label: "Referencias de lentes", allowed: ACCESS.lenses },
  { to: "/usuarios", label: "Usuarios", allowed: "admin" },
];

const visible = (item: NavItem, role: UserRole) =>
  item.allowed === "all" || (item.allowed === "admin" ? role === "admin" : can(role, item.allowed));

export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="shrink-0 bg-slate-900 text-slate-100 md:w-64">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <p className="text-lg font-semibold tracking-tight">Harmony Lens</p>
          <p className="text-xs text-slate-400">Bodega principal</p>
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.filter((item) => visible(item, user.role)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-right text-sm leading-tight">
            <p className="font-medium text-slate-900">{user.fullName}</p>
            <p className="text-slate-500">{ROLE_LABEL[user.role]}</p>
          </div>
          <Button variant="secondary" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </header>
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
