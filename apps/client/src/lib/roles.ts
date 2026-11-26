import type { UserRole } from "@harmonylens/shared";

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  jefe_almacen: "Jefe de almacén",
  auxiliar_bodega: "Auxiliar de bodega",
  director_tecnico: "Director técnico",
  admin_puntos_venta: "Administrador de puntos de venta",
  asesor_punto_venta: "Asesor de punto de venta",
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({
  value: value as UserRole,
  label,
}));

/** Mirrors the server's @Roles() rules. `admin` can open everything. */
export const can = (role: UserRole, allowed: readonly UserRole[]): boolean =>
  role === "admin" || allowed.includes(role);

export const ACCESS = {
  inventory: ["jefe_almacen", "auxiliar_bodega", "director_tecnico"],
  imports: ["jefe_almacen", "auxiliar_bodega"],
  authorize: ["director_tecnico"],
  lenses: ["jefe_almacen", "auxiliar_bodega"],
  editLenses: ["jefe_almacen"],
  users: [],
} as const satisfies Record<string, readonly UserRole[]>;
