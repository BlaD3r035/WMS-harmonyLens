import { Link } from "react-router";
import { EmptyState } from "../components/ui";

export function NotFoundPage() {
  return (
    <EmptyState title="Página no encontrada">
      <Link to="/" className="text-teal-700 underline">
        Volver al inicio
      </Link>
    </EmptyState>
  );
}
