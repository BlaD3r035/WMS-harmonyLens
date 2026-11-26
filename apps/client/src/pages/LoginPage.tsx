import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../auth/useAuth";
import { Alert, Button, Card, Loading, TextField } from "../components/ui";
import { ApiRequestError } from "../lib/api";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Loading />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 400) setFieldErrors(e.errors);
      else setError(e instanceof Error ? e.message : "No se pudo iniciar sesión");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Harmony Lens</h1>
          <p className="text-sm text-slate-600">Gestión de inventario de bodega</p>
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <TextField
              label="Correo"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
            />
            <TextField
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />
            <Button type="submit" loading={submitting} className="w-full">
              Iniciar sesión
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-500">
          ¿Necesitas una cuenta? Pídesela a un administrador.
        </p>
      </div>
    </div>
  );
}
