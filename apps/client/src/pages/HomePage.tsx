import { Link } from "react-router";
import type { ImportSummary, InventoryReference, Lot } from "@harmonylens/shared";
import { useAuth } from "../auth/useAuth";
import { Alert, Card, Loading, PageHeader } from "../components/ui";
import { useQuery } from "../lib/useQuery";
import { ACCESS, ROLE_LABEL, can } from "../lib/roles";
import { formatDate } from "../lib/format";

function Stat({ label, value, to, tone = "slate" }: { label: string; value: number; to: string; tone?: "slate" | "amber" | "red" }) {
  const tones = { slate: "text-slate-900", amber: "text-amber-700", red: "text-red-700" };
  return (
    <Link to={to} className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-600">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${tones[tone]}`}>{value}</p>
    </Link>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const role = user!.role;
  const seesInventory = can(role, ACCESS.inventory);
  const seesImports = can(role, ACCESS.imports);

  const pending = useQuery<Lot[]>(seesInventory ? "/lots?status=pendiente_revision" : null);
  const alerts = useQuery<InventoryReference[]>(seesInventory ? "/inventory/references" : null);
  const imports = useQuery<ImportSummary[]>(seesImports ? "/imports" : null);

  const low = alerts.data?.filter((r) => r.state === "bajo").length ?? 0;
  const out = alerts.data?.filter((r) => r.state === "agotada").length ?? 0;
  const loading = pending.loading || alerts.loading || imports.loading;
  const error = pending.error ?? alerts.error ?? imports.error;

  return (
    <>
      <PageHeader title={`Hola, ${user!.fullName.split(" ")[0]}`} subtitle={ROLE_LABEL[role]} />

      {error && <Alert>{error}</Alert>}
      {loading && !error && <Loading />}

      {!seesInventory && !seesImports && (
        <Card className="p-6 text-sm text-slate-600">
          Tu rol no tiene módulos habilitados todavía. Las solicitudes y pedidos de surtido llegarán en una próxima versión.
        </Card>
      )}

      {seesInventory && alerts.data && pending.data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Lotes pendientes de revisión" value={pending.data.length} to={can(role, ACCESS.authorize) ? "/autorizacion" : "/inventario"} tone={pending.data.length ? "amber" : "slate"} />
          <Stat label="Referencias con stock bajo" value={low} to="/inventario" tone={low ? "amber" : "slate"} />
          <Stat label="Referencias agotadas" value={out} to="/inventario" tone={out ? "red" : "slate"} />
        </div>
      )}

      {seesImports && imports.data && (
        <Card className="mt-6">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="font-semibold text-slate-900">Últimas importaciones</h2>
            <Link to="/importaciones" className="text-sm text-teal-700 hover:underline">
              Ver todas
            </Link>
          </div>
          {imports.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Aún no hay importaciones registradas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {imports.data.slice(0, 5).map((i) => (
                <li key={i.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium text-slate-800">{i.distributor}</span>
                  <span className="text-slate-500">
                    {i.lotCount} {i.lotCount === 1 ? "lote" : "lotes"} · {i.totalUnits} lentes · {formatDate(i.receivedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
