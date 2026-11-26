import { useState } from "react";
import type { InventoryReference, Lot, LotStatus, StockState } from "@harmonylens/shared";
import { useAuth } from "../auth/useAuth";
import { LocationModal } from "../components/LocationModal";
import { LotStatusBadge, StockBadge } from "../components/StatusBadge";
import { Alert, Button, Card, EmptyState, Loading, PageHeader, SelectField, Table, Td, TextField, Th } from "../components/ui";
import { formula } from "../lib/format";
import { ACCESS, can } from "../lib/roles";
import { useDebounced } from "../lib/useDebounced";
import { useQuery } from "../lib/useQuery";

type Tab = "references" | "lots";

function query(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : "";
}

function StockAlerts() {
  const { data, error } = useQuery<InventoryReference[]>("/inventory/references");
  if (error) return <Alert>{error}</Alert>;
  const flagged = data?.filter((r) => r.state !== "ok") ?? [];
  if (flagged.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4" role="region" aria-label="Alertas de inventario">
      <h2 className="font-semibold text-amber-900">
        {flagged.length} {flagged.length === 1 ? "referencia requiere" : "referencias requieren"} reposición
      </h2>
      <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {flagged.slice(0, 12).map((r) => (
          <li key={r.lensId} className="flex items-center justify-between gap-2 text-amber-950">
            <span className="truncate">
              <strong>{r.code}</strong> · {r.description}
            </span>
            <span className="shrink-0">
              {r.state === "agotada" ? <StockBadge state="agotada" /> : `${r.available} / mín. ${r.minStock}`}
            </span>
          </li>
        ))}
      </ul>
      {flagged.length > 12 && <p className="mt-2 text-xs text-amber-900">y {flagged.length - 12} más. Filtra por estado para verlas todas.</p>}
    </div>
  );
}

function ReferencesTab() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<"" | StockState>("");
  const debounced = useDebounced(q);
  const { data, error, loading } = useQuery<InventoryReference[]>(`/inventory/references${query({ q: debounced.trim(), state })}`);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <TextField label="Buscar referencia" className="w-64" value={q} placeholder="Código o descripción" onChange={(e) => setQ(e.target.value)} />
        <SelectField label="Estado" className="w-48" value={state} onChange={(e) => setState(e.target.value as "" | StockState)}>
          <option value="">Todos</option>
          <option value="agotada">Agotada</option>
          <option value="bajo">Stock bajo</option>
          <option value="ok">Disponible</option>
        </SelectField>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Loading />}
      {data && (
        <Card>
          {data.length === 0 ? (
            <EmptyState title="Sin resultados">No hay referencias que coincidan con el filtro.</EmptyState>
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Código</Th>
                  <Th>Descripción</Th>
                  <Th>Fórmula</Th>
                  <Th className="text-right">Disponible</Th>
                  <Th className="text-right">En revisión</Th>
                  <Th className="text-right">Mínimo</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((r) => (
                  <tr key={r.lensId}>
                    <Td className="font-medium text-slate-900">{r.code}</Td>
                    <Td>{r.description}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{formula(r.sphere, r.cylinder)}</Td>
                    <Td className="text-right tabular-nums font-medium">{r.available}</Td>
                    <Td className="text-right tabular-nums text-slate-500">{r.quarantine}</Td>
                    <Td className="text-right tabular-nums">{r.minStock}</Td>
                    <Td>
                      <StockBadge state={r.state} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}

function LotsTab() {
  const { user } = useAuth();
  const canLocate = can(user!.role, ACCESS.imports);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | LotStatus>("");
  const [locating, setLocating] = useState<Lot | null>(null);
  const debounced = useDebounced(q);
  const { data, error, loading, reload } = useQuery<Lot[]>(`/lots${query({ q: debounced.trim(), status })}`);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <TextField label="Buscar por lote o referencia" className="w-72" value={q} placeholder="N.º de lote, código o descripción" onChange={(e) => setQ(e.target.value)} />
        <SelectField label="Estado" className="w-52" value={status} onChange={(e) => setStatus(e.target.value as "" | LotStatus)}>
          <option value="">Todos</option>
          <option value="autorizado">Autorizado</option>
          <option value="pendiente_revision">Pendiente de revisión</option>
          <option value="rechazado">Rechazado</option>
        </SelectField>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Loading />}
      {data && (
        <Card>
          {data.length === 0 ? (
            <EmptyState title="Sin lotes">No hay lotes que coincidan con el filtro.</EmptyState>
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Lote</Th>
                  <Th>Referencia</Th>
                  <Th className="text-right">Disponible</Th>
                  <Th>Ubicación</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((lot) => (
                  <tr key={lot.id}>
                    <Td className="font-medium text-slate-900">{lot.lotNumber}</Td>
                    <Td>
                      <p className="font-medium text-slate-900">{lot.lensCode}</p>
                      <p className="text-xs text-slate-500">
                        {lot.lensDescription} · {formula(lot.sphere, lot.cylinder)}
                      </p>
                    </Td>
                    <Td className="text-right tabular-nums font-medium">{lot.quantity}</Td>
                    <Td>
                      {lot.locationCode ?? <span className="text-slate-400">Sin ubicar</span>}
                      {canLocate && (
                        <Button variant="ghost" className="ml-1 px-2 py-1 text-xs" onClick={() => setLocating(lot)}>
                          {lot.locationCode ? "Cambiar" : "Ubicar"}
                        </Button>
                      )}
                    </Td>
                    <Td>
                      <LotStatusBadge status={lot.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
      {locating && (
        <LocationModal
          lot={locating}
          onClose={() => setLocating(null)}
          onSaved={() => {
            setLocating(null);
            reload();
          }}
        />
      )}
    </>
  );
}

export function InventoryPage() {
  const [tab, setTab] = useState<Tab>("references");
  const tabs: { id: Tab; label: string }[] = [
    { id: "references", label: "Por referencia" },
    { id: "lots", label: "Por lote" },
  ];

  return (
    <>
      <PageHeader title="Inventario" subtitle="Existencias de la bodega principal. Solo los lotes autorizados cuentan como disponibles." />
      <StockAlerts />
      <div role="tablist" aria-label="Vista de inventario" className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "references" ? <ReferencesTab /> : <LotsTab />}
    </>
  );
}
