export const signed = (n: number): string => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;

/** "Esf +1.00 / Cil -0.75" */
export const formula = (sphere: number, cylinder: number): string =>
  `${signed(sphere)} / ${signed(cylinder)}`;

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateOnly = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
export const formatDate = (iso: string): string => dateOnly.format(new Date(iso));

/** Quarter-step options for the lens formula selects. */
const steps = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let i = Math.round(from * 4); i <= Math.round(to * 4); i++) out.push(i / 4);
  return out;
};
export const SPHERE_OPTIONS = steps(-4, 4);
export const CYLINDER_OPTIONS = steps(-4, 0).reverse();
