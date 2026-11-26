import { useState } from "react";
import type { FormEvent } from "react";
import type { Lens } from "@harmonylens/shared";
import { useAuth } from "../auth/useAuth";
import { Alert, Button, Card, EmptyState, Loading, Modal, PageHeader, SelectField, Table, Td, TextField, Th } from "../components/ui";
import { api, ApiRequestError, errorMessage } from "../lib/api";
import { CYLINDER_OPTIONS, SPHERE_OPTIONS, formula, signed } from "../lib/format";
import { ACCESS, can } from "../lib/roles";
import { useDebounced } from "../lib/useDebounced";
import { useQuery } from "../lib/useQuery";

const EMPTY = { code: "", description: "", sphere: "0", cylinder: "0", minStock: "0" };

function NewLensForm({ onCreated }: { onCreated: (lens: Lens) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const local: Record<string, string> = {};
    if (!form.code.trim()) local.code = "El código es obligatorio";
    if (!form.description.trim()) local.description = "La descripción es obligatoria";
    if (!/^\d+$/.test(form.minStock)) local.minStock = "Debe ser un número entero";
    if (Object.keys(local).length) return setErrors(local);

    setBusy(true);
    try {
      const lens = await api<Lens>("POST", "/lenses", {
        code: form.code,
        description: form.description,
        sphere: Number(form.sphere),
        cylinder: Number(form.cylinder),
        minStock: Number(form.minStock),
      });
      setForm(EMPTY);
      setErrors({});
      onCreated(lens);
    } catch (e) {
      if (e instanceof ApiRequestError && Object.keys(e.errors).length) setErrors(e.errors);
      else setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Registrar referencia</h2>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-6">
        {formError && (
          <div className="sm:col-span-6">
            <Alert>{formError}</Alert>
          </div>
        )}
        <TextField label="Código" className="sm:col-span-2" value={form.code} maxLength={40} onChange={set("code")} error={errors.code} hint="Identificador en el sistema" />
        <TextField label="Descripción" className="sm:col-span-4" value={form.description} maxLength={300} onChange={set("description")} error={errors.description} />
        <SelectField label="Esfera" className="sm:col-span-2" value={form.sphere} onChange={set("sphere")} error={errors.sphere} hint="−4.00 a +4.00, de 0.25 en 0.25">
          {SPHERE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {signed(n)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Cilindro" className="sm:col-span-2" value={form.cylinder} onChange={set("cylinder")} error={errors.cylinder} hint="0.00 a −4.00, solo negativo">
          {CYLINDER_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {signed(n)}
            </option>
          ))}
        </SelectField>
        <TextField label="Stock mínimo" type="number" min={0} className="sm:col-span-2" value={form.minStock} onChange={set("minStock")} error={errors.minStock} hint="Genera alerta al llegar a esta cantidad" />
        <div className="sm:col-span-6">
          <Button type="submit" loading={busy}>
            Registrar referencia
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EditLensModal({ lens, onClose, onSaved }: { lens: Lens; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState(lens.description);
  const [minStock, setMinStock] = useState(String(lens.minStock));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!/^\d+$/.test(minStock)) return setErrors({ minStock: "Debe ser un número entero" });
    if (!description.trim()) return setErrors({ description: "La descripción es obligatoria" });
    setBusy(true);
    try {
      await api("PATCH", `/lenses/${lens.id}`, { description, minStock: Number(minStock) });
      onSaved();
    } catch (e) {
      setErrors(e instanceof ApiRequestError && Object.keys(e.errors).length ? e.errors : { description: errorMessage(e) });
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Editar ${lens.code}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Fórmula {formula(lens.sphere, lens.cylinder)}. El código y la fórmula no se pueden cambiar.</p>
        <TextField label="Descripción" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} error={errors.description} />
        <TextField label="Stock mínimo" type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} error={errors.minStock} />
      </div>
    </Modal>
  );
}

export function LensesPage() {
  const { user } = useAuth();
  const canEdit = can(user!.role, ACCESS.editLenses);
  const [q, setQ] = useState("");
  const debounced = useDebounced(q).trim();
  const { data, error, loading, reload } = useQuery<Lens[]>(`/lenses${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`);
  const [editing, setEditing] = useState<Lens | null>(null);
  const [created, setCreated] = useState<string>();

  return (
    <>
      <PageHeader title="Referencias de lentes" subtitle="Catálogo de productos. Cada referencia se identifica por su código y su fórmula (esfera y cilindro)." />
      {created && (
        <div className="mb-4">
          <Alert tone="success">Referencia {created} registrada.</Alert>
        </div>
      )}
      {canEdit && (
        <NewLensForm
          onCreated={(lens) => {
            setCreated(lens.code);
            reload();
          }}
        />
      )}

      <TextField label="Buscar" className="mb-4 w-72" value={q} placeholder="Código o descripción" onChange={(e) => setQ(e.target.value)} />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Loading />}
      {data && (
        <Card>
          {data.length === 0 ? (
            <EmptyState title={debounced ? "Sin resultados" : "Aún no hay referencias"}>
              {debounced ? "Prueba con otro código o descripción." : canEdit ? "Registra la primera referencia con el formulario de arriba." : "Pídele al jefe de almacén que registre las referencias."}
            </EmptyState>
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Código</Th>
                  <Th>Descripción</Th>
                  <Th>Esfera</Th>
                  <Th>Cilindro</Th>
                  <Th className="text-right">Stock mínimo</Th>
                  {canEdit && (
                    <Th>
                      <span className="sr-only">Acciones</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((lens) => (
                  <tr key={lens.id}>
                    <Td className="font-medium text-slate-900">{lens.code}</Td>
                    <Td>{lens.description}</Td>
                    <Td className="tabular-nums">{signed(lens.sphere)}</Td>
                    <Td className="tabular-nums">{signed(lens.cylinder)}</Td>
                    <Td className="text-right tabular-nums">{lens.minStock}</Td>
                    {canEdit && (
                      <Td className="text-right">
                        <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(lens)}>
                          Editar
                        </Button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
      {editing && (
        <EditLensModal
          lens={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
