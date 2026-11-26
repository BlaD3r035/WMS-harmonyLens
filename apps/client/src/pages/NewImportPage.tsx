import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { ImportDetail, Lens, WarehouseLocation } from "@harmonylens/shared";
import { Alert, Button, Card, Loading, PageHeader, SelectField, TextAreaField, TextField } from "../components/ui";
import { api, ApiRequestError, errorMessage } from "../lib/api";
import { formula } from "../lib/format";
import { useQuery } from "../lib/useQuery";

interface LotForm {
  key: number;
  lensCode: string;
  lotNumber: string;
  invimaRegistration: string;
  boxCount: string;
  quantity: string;
  locationId: string;
  qualityNotes: string;
}

let nextKey = 1;
const emptyLot = (): LotForm => ({
  key: nextKey++,
  lensCode: "",
  lotNumber: "",
  invimaRegistration: "",
  boxCount: "",
  quantity: "",
  locationId: "",
  qualityNotes: "",
});

const isPositiveInt = (v: string) => /^\d+$/.test(v) && Number(v) > 0;

export function NewImportPage() {
  const navigate = useNavigate();
  const lenses = useQuery<Lens[]>("/lenses");
  const locations = useQuery<WarehouseLocation[]>("/locations");

  const [header, setHeader] = useState({ distributor: "", invoiceNumber: "", manufacturer: "", notes: "" });
  const [lots, setLots] = useState<LotForm[]>(() => [emptyLot()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const lensByCode = new Map((lenses.data ?? []).map((l) => [l.code.toLowerCase(), l]));

  const clear = (key: string) => setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  const setHeaderField = (field: keyof typeof header) => (e: { target: { value: string } }) => {
    setHeader((h) => ({ ...h, [field]: e.target.value }));
    clear(field);
  };
  const setLotField = (index: number, field: keyof LotForm, value: string) => {
    setLots((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
    clear(`lots.${index}.${field === "lensCode" ? "lensId" : field}`);
  };

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    if (!header.distributor.trim()) found.distributor = "El distribuidor es obligatorio";
    const seen = new Set<string>();
    lots.forEach((lot, i) => {
      const p = `lots.${i}.`;
      if (!lensByCode.has(lot.lensCode.trim().toLowerCase())) found[`${p}lensId`] = "Selecciona una referencia existente";
      if (!lot.lotNumber.trim()) found[`${p}lotNumber`] = "El lote es obligatorio";
      else if (seen.has(lot.lotNumber.trim().toLowerCase())) found[`${p}lotNumber`] = "Lote repetido en esta importación";
      seen.add(lot.lotNumber.trim().toLowerCase());
      if (!lot.invimaRegistration.trim()) found[`${p}invimaRegistration`] = "El registro INVIMA es obligatorio";
      if (!isPositiveInt(lot.boxCount)) found[`${p}boxCount`] = "Debe ser un entero mayor a 0";
      if (!isPositiveInt(lot.quantity)) found[`${p}quantity`] = "Debe ser un entero mayor a 0";
    });
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError("Revisa los campos marcados en rojo.");
      return;
    }

    setBusy(true);
    try {
      const created = await api<ImportDetail>("POST", "/imports", {
        distributor: header.distributor,
        invoiceNumber: header.invoiceNumber,
        manufacturer: header.manufacturer,
        notes: header.notes,
        lots: lots.map((l) => ({
          lensId: lensByCode.get(l.lensCode.trim().toLowerCase())!.id,
          lotNumber: l.lotNumber,
          invimaRegistration: l.invimaRegistration,
          boxCount: Number(l.boxCount),
          quantity: Number(l.quantity),
          qualityNotes: l.qualityNotes,
          locationId: l.locationId || null,
        })),
      });
      void navigate("/importaciones", {
        state: { created: `Importación registrada: ${created.lotCount} ${created.lotCount === 1 ? "lote" : "lotes"} (${created.totalUnits} lentes) pendientes de revisión.` },
      });
    } catch (e) {
      if (e instanceof ApiRequestError && Object.keys(e.errors).length) setErrors(e.errors);
      setFormError(errorMessage(e));
      setBusy(false);
    }
  }

  if (lenses.loading && !lenses.data) return <Loading />;

  return (
    <>
      <PageHeader title="Registrar importación" subtitle="Documenta la llegada de mercancía: distribuidor, factura y cada lote recibido." />

      {lenses.error && <Alert>{lenses.error}</Alert>}
      {lenses.data?.length === 0 && (
        <div className="mb-4">
          <Alert tone="warning">
            Todavía no hay referencias de lentes. Pídele al jefe de almacén que las registre en{" "}
            <Link to="/referencias" className="underline">
              Referencias de lentes
            </Link>
            .
          </Alert>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-6">
        {formError && <Alert>{formError}</Alert>}

        <Card className="grid gap-4 p-5 sm:grid-cols-3">
          <TextField label="Distribuidor" value={header.distributor} maxLength={120} onChange={setHeaderField("distributor")} error={errors.distributor} />
          <TextField label="Número de factura" value={header.invoiceNumber} maxLength={60} onChange={setHeaderField("invoiceNumber")} error={errors.invoiceNumber} />
          <TextField label="Fabricante" value={header.manufacturer} maxLength={120} onChange={setHeaderField("manufacturer")} error={errors.manufacturer} />
          <TextAreaField label="Notas" className="sm:col-span-3" value={header.notes} maxLength={500} onChange={setHeaderField("notes")} error={errors.notes} />
        </Card>

        <datalist id="lens-codes">
          {(lenses.data ?? []).map((l) => (
            <option key={l.id} value={l.code}>
              {l.description}
            </option>
          ))}
        </datalist>

        {lots.map((lot, i) => {
          const p = `lots.${i}.`;
          const lens = lensByCode.get(lot.lensCode.trim().toLowerCase());
          return (
            <Card key={lot.key} className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Lote {i + 1}</h2>
                {lots.length > 1 && (
                  <Button variant="ghost" onClick={() => setLots((prev) => prev.filter((l) => l.key !== lot.key))}>
                    Quitar
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <TextField
                    label="Referencia (código)"
                    list="lens-codes"
                    value={lot.lensCode}
                    autoComplete="off"
                    onChange={(e) => setLotField(i, "lensCode", e.target.value)}
                    error={errors[`${p}lensId`]}
                    hint={lens ? `${lens.description} · ${formula(lens.sphere, lens.cylinder)}` : "Escribe para buscar el código"}
                  />
                </div>
                <TextField label="Lote" className="sm:col-span-3" value={lot.lotNumber} maxLength={60} onChange={(e) => setLotField(i, "lotNumber", e.target.value)} error={errors[`${p}lotNumber`]} />
                <TextField label="Registro INVIMA" className="sm:col-span-3" value={lot.invimaRegistration} maxLength={60} onChange={(e) => setLotField(i, "invimaRegistration", e.target.value)} error={errors[`${p}invimaRegistration`]} />
                <TextField label="Cantidad de cajas" type="number" min={1} className="sm:col-span-1" value={lot.boxCount} onChange={(e) => setLotField(i, "boxCount", e.target.value)} error={errors[`${p}boxCount`]} />
                <TextField label="Cantidad de lentes" type="number" min={1} className="sm:col-span-2" value={lot.quantity} onChange={(e) => setLotField(i, "quantity", e.target.value)} error={errors[`${p}quantity`]} />
                <SelectField label="Ubicación (opcional)" className="sm:col-span-3" value={lot.locationId} onChange={(e) => setLotField(i, "locationId", e.target.value)} error={errors[`${p}locationId`]}>
                  <option value="">Sin ubicar todavía</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
                    </option>
                  ))}
                </SelectField>
                <TextField label="Calidad con que llegaron (opcional)" className="sm:col-span-3" value={lot.qualityNotes} maxLength={500} onChange={(e) => setLotField(i, "qualityNotes", e.target.value)} />
              </div>
            </Card>
          );
        })}

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setLots((prev) => [...prev, emptyLot()])}>
            + Agregar otro lote
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={() => void navigate("/importaciones")}>
            Cancelar
          </Button>
          <Button type="submit" loading={busy}>
            Registrar importación
          </Button>
        </div>
      </form>
    </>
  );
}
