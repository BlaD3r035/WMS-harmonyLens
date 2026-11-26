import { useState } from "react";
import type { Lot, WarehouseLocation } from "@harmonylens/shared";
import { api, ApiRequestError, errorMessage } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { Alert, Button, Loading, Modal, SelectField, TextField } from "./ui";

const NEW = "__new__";

/** Assigns a shelf location to a lot, optionally creating the location first. */
export function LocationModal({ lot, onClose, onSaved }: { lot: Lot; onClose: () => void; onSaved: () => void }) {
  const locations = useQuery<WarehouseLocation[]>("/locations");
  const [choice, setChoice] = useState(lot.locationId ?? "");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(undefined);
    if (!choice) return setError("Selecciona una ubicación");
    if (choice === NEW && !newCode.trim()) return setError("Escribe el código de la ubicación");
    setBusy(true);
    try {
      let locationId = choice;
      if (choice === NEW) {
        locationId = (await api<WarehouseLocation>("POST", "/locations", { code: newCode })).id;
      }
      await api("PATCH", `/lots/${lot.id}/location`, { locationId });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiRequestError ? (e.errors.code ?? e.message) : errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Ubicar lote ${lot.lotNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Guardar ubicación
          </Button>
        </>
      }
    >
      {locations.loading && !locations.data && <Loading />}
      {locations.error && <Alert>{locations.error}</Alert>}
      {locations.data && (
        <div className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <SelectField label="Ubicación en estantería" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Selecciona…</option>
            {locations.data.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code}
                {l.description ? ` — ${l.description}` : ""}
              </option>
            ))}
            <option value={NEW}>+ Crear ubicación nueva</option>
          </SelectField>
          {choice === NEW && (
            <TextField label="Código de la nueva ubicación" value={newCode} maxLength={40} placeholder="A-03-12" autoFocus onChange={(e) => setNewCode(e.target.value)} />
          )}
        </div>
      )}
    </Modal>
  );
}
