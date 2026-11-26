import { useState } from "react";
import type { Lot } from "@harmonylens/shared";
import { Alert, Button, Card, EmptyState, Loading, Modal, PageHeader, Table, TextAreaField, Td, Th } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { formatDateTime, formula } from "../lib/format";
import { useQuery } from "../lib/useQuery";

type Pending = { kind: "approve" | "reject"; lot: Lot } | null;

export function AuthorizePage() {
  const { data: lots, error, loading, reload } = useQuery<Lot[]>("/lots?status=pendiente_revision");
  const [action, setAction] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function open(kind: "approve" | "reject", lot: Lot) {
    setAction({ kind, lot });
    setReason("");
    setReasonError(undefined);
  }

  async function confirm() {
    if (!action) return;
    const { kind, lot } = action;
    if (kind === "reject" && !reason.trim()) {
      setReasonError("Debes escribir el motivo del rechazo");
      return;
    }
    setBusy(true);
    try {
      await api("POST", `/lots/${lot.id}/${kind}`, kind === "reject" ? { reason: reason.trim() } : undefined);
      setNotice({
        tone: "success",
        text: kind === "approve" ? `Lote ${lot.lotNumber} autorizado.` : `Lote ${lot.lotNumber} rechazado.`,
      });
    } catch (e) {
      setNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
      setAction(null);
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Autorizar lotes"
        subtitle="Lotes recibidos que esperan la revisión del director técnico. Solo los lotes autorizados pueden salir a los puntos de venta."
      />
      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      {loading && !lots && <Loading />}

      {lots && (
        <Card>
          {lots.length === 0 ? (
            <EmptyState title="No hay lotes pendientes de revisión">Cuando llegue una importación, sus lotes aparecerán aquí.</EmptyState>
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Lote</Th>
                  <Th>Distribuidor</Th>
                  <Th>Recepción</Th>
                  <Th>Referencia</Th>
                  <Th className="text-right">Cantidad</Th>
                  <Th>
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lots.map((lot) => (
                  <tr key={lot.id}>
                    <Td>
                      <p className="font-medium text-slate-900">{lot.lotNumber}</p>
                      <p className="text-xs text-slate-500">
                        {lot.invimaRegistration} · {lot.boxCount} {lot.boxCount === 1 ? "caja" : "cajas"}
                        {lot.locationCode ? ` · ${lot.locationCode}` : " · Sin ubicar"}
                      </p>
                      {lot.qualityNotes && <p className="mt-0.5 text-xs text-amber-800">Calidad: {lot.qualityNotes}</p>}
                    </Td>
                    <Td>{lot.distributor ?? "—"}</Td>
                    <Td>{formatDateTime(lot.receivedAt)}</Td>
                    <Td>
                      <p className="font-medium text-slate-900">{lot.lensCode}</p>
                      <p className="text-xs text-slate-500">
                        {lot.lensDescription} · {formula(lot.sphere, lot.cylinder)}
                      </p>
                    </Td>
                    <Td className="text-right tabular-nums">{lot.quantity}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => open("approve", lot)}>Aprobar</Button>
                        <Button variant="secondary" onClick={() => open("reject", lot)}>
                          Rechazar
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {action?.kind === "approve" && (
        <Modal
          title="Aprobar lote"
          onClose={() => setAction(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAction(null)}>
                Cancelar
              </Button>
              <Button loading={busy} onClick={() => void confirm()}>
                Aprobar lote
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            El lote <strong>{action.lot.lotNumber}</strong> ({action.lot.quantity} lentes, {action.lot.lensCode}) quedará
            autorizado y disponible para despacho a los puntos de venta. Se registrará tu usuario, la fecha y la hora.
          </p>
        </Modal>
      )}

      {action?.kind === "reject" && (
        <Modal
          title="Rechazar lote"
          onClose={() => setAction(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAction(null)}>
                Cancelar
              </Button>
              <Button variant="danger" loading={busy} onClick={() => void confirm()}>
                Rechazar lote
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm text-slate-700">
            El lote <strong>{action.lot.lotNumber}</strong> quedará bloqueado para despacho.
          </p>
          <TextAreaField
            label="Motivo del rechazo"
            value={reason}
            maxLength={500}
            autoFocus
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(undefined);
            }}
            error={reasonError}
            hint="Ej.: lentes con defectos, cantidades que no corresponden al pedido."
          />
        </Modal>
      )}
    </>
  );
}
