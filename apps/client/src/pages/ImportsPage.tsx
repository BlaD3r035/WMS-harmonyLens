import { useState } from "react";
import { Link, useLocation } from "react-router";
import type { ImportDetail, ImportSummary } from "@harmonylens/shared";
import { LotStatusBadge } from "../components/StatusBadge";
import { Alert, Button, Card, EmptyState, Loading, PageHeader, Table, Td, Th } from "../components/ui";
import { formatDateTime, formula } from "../lib/format";
import { useQuery } from "../lib/useQuery";

function ImportRow({ item }: { item: ImportSummary }) {
  const [open, setOpen] = useState(false);
  const detail = useQuery<ImportDetail>(open ? `/imports/${item.id}` : null);

  return (
    <>
      <tr>
        <Td>{formatDateTime(item.receivedAt)}</Td>
        <Td className="font-medium text-slate-900">{item.distributor}</Td>
        <Td>{item.invoiceNumber ?? "—"}</Td>
        <Td>{item.manufacturer ?? "—"}</Td>
        <Td className="text-right tabular-nums">{item.lotCount}</Td>
        <Td className="text-right tabular-nums">{item.totalUnits}</Td>
        <Td className="text-right">
          <Button variant="ghost" className="px-2 py-1" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Ocultar lotes" : "Ver lotes"}
          </Button>
        </Td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="bg-slate-50 px-4 py-3">
            {detail.error && <Alert>{detail.error}</Alert>}
            {detail.loading && !detail.data && <Loading />}
            {detail.data && (
              <ul className="divide-y divide-slate-200 text-sm">
                {detail.data.notes && <li className="pb-2 text-slate-600">Notas: {detail.data.notes}</li>}
                {detail.data.lots.map((lot) => (
                  <li key={lot.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <strong className="text-slate-900">{lot.lotNumber}</strong> · {lot.lensCode} ({formula(lot.sphere, lot.cylinder)}) · INVIMA {lot.invimaRegistration}
                    </span>
                    <span className="flex items-center gap-3 text-slate-600">
                      {lot.boxCount} cajas · {lot.quantityReceived} lentes
                      <LotStatusBadge status={lot.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function ImportsPage() {
  const { data, error, loading } = useQuery<ImportSummary[]>("/imports");
  const created = (useLocation().state as { created?: string } | null)?.created;

  return (
    <>
      <PageHeader
        title="Importaciones"
        subtitle="Registro de la mercancía que llega a la bodega. Cada lote queda en cuarentena hasta que el director técnico lo autorice."
        actions={
          <Link to="/importaciones/nueva">
            <span className="inline-flex rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">Registrar importación</span>
          </Link>
        }
      />
      {created && (
        <div className="mb-4">
          <Alert tone="success">{created}</Alert>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Loading />}
      {data && (
        <Card>
          {data.length === 0 ? (
            <EmptyState title="Aún no hay importaciones">Registra la primera cuando llegue mercancía.</EmptyState>
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Recepción</Th>
                  <Th>Distribuidor</Th>
                  <Th>Factura</Th>
                  <Th>Fabricante</Th>
                  <Th className="text-right">Lotes</Th>
                  <Th className="text-right">Lentes</Th>
                  <Th>
                    <span className="sr-only">Detalle</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => (
                  <ImportRow key={item.id} item={item} />
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
