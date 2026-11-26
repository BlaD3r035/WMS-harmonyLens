import { Navigate, Outlet, useLocation } from "react-router";
import type { UserRole } from "@harmonylens/shared";
import { Loading } from "../components/ui";
import { can } from "../lib/roles";
import { useAuth } from "./useAuth";

/** Shows nested routes only to signed-in users; others go to /login. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** `allowed` omitted means admin only. */
export function RequireRole({ allowed }: { allowed?: readonly UserRole[] }) {
  const { user } = useAuth();
  if (!user || !can(user.role, allowed ?? [])) return <Navigate to="/" replace />;
  return <Outlet />;
}
