import { useState } from "react";
import type { FormEvent } from "react";
import type { AuthUser, UserRole, UserSummary } from "@harmonylens/shared";
import { Alert, Badge, Button, Card, EmptyState, Loading, PageHeader, SelectField, Table, Td, TextField, Th } from "../components/ui";
import { api, ApiRequestError, errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { ROLE_LABEL, ROLE_OPTIONS } from "../lib/roles";
import { useQuery } from "../lib/useQuery";

const EMPTY = { fullName: "", email: "", password: "", role: "" as "" | UserRole };

export function UsersPage() {
  const { data, error, loading, reload } = useQuery<UserSummary[]>("/users");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [created, setCreated] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setCreated(undefined);
    const local: Record<string, string> = {};
    if (form.fullName.trim().length < 2) local.fullName = "El nombre es obligatorio";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) local.email = "Correo no válido";
    if (form.password.length < 8) local.password = "Mínimo 8 caracteres";
    if (!form.role) local.role = "Selecciona un rol";
    if (Object.keys(local).length) return setErrors(local);

    setBusy(true);
    try {
      const user = await api<AuthUser>("POST", "/users", form);
      setCreated(`Usuario ${user.email} registrado como ${ROLE_LABEL[user.role]}.`);
      setForm(EMPTY);
      setErrors({});
      reload();
    } catch (e) {
      if (e instanceof ApiRequestError && Object.keys(e.errors).length) setErrors(e.errors);
      else setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Solo los administradores pueden registrar usuarios nuevos y asignarles un rol." />

      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Registrar usuario</h2>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          {created && (
            <div className="sm:col-span-2">
              <Alert tone="success">{created}</Alert>
            </div>
          )}
          {formError && (
            <div className="sm:col-span-2">
              <Alert>{formError}</Alert>
            </div>
          )}
          <TextField label="Nombre completo" autoComplete="off" value={form.fullName} maxLength={120} onChange={set("fullName")} error={errors.fullName} />
          <TextField label="Correo" type="email" autoComplete="off" value={form.email} onChange={set("email")} error={errors.email} />
          <TextField label="Contraseña inicial" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="Mínimo 8 caracteres" />
          <SelectField label="Rol" value={form.role} onChange={set("role")} error={errors.role}>
            <option value="">Selecciona…</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectField>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy}>
              Registrar usuario
            </Button>
          </div>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}
      {loading && !data && <Loading />}
      {data && (
        <Card>
          {data.length === 0 ? (
            <EmptyState title="No hay usuarios" />
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Nombre</Th>
                  <Th>Correo</Th>
                  <Th>Rol</Th>
                  <Th>Estado</Th>
                  <Th>Creado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((u) => (
                  <tr key={u.id}>
                    <Td className="font-medium text-slate-900">{u.fullName}</Td>
                    <Td>{u.email}</Td>
                    <Td>{ROLE_LABEL[u.role]}</Td>
                    <Td>{u.isActive ? <Badge tone="green">Activo</Badge> : <Badge tone="slate">Inactivo</Badge>}</Td>
                    <Td>{formatDate(u.createdAt)}</Td>
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
