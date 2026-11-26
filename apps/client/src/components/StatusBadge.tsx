import type { LotStatus, StockState } from "@harmonylens/shared";
import { Badge } from "./ui";

export function LotStatusBadge({ status }: { status: LotStatus }) {
  switch (status) {
    case "pendiente_revision":
      return <Badge tone="amber">Pendiente de revisión</Badge>;
    case "autorizado":
      return <Badge tone="green">Autorizado</Badge>;
    case "rechazado":
      return <Badge tone="red">Rechazado</Badge>;
  }
}

export function StockBadge({ state }: { state: StockState }) {
  switch (state) {
    case "agotada":
      return <Badge tone="red">Agotada</Badge>;
    case "bajo":
      return <Badge tone="amber">Stock bajo</Badge>;
    case "ok":
      return <Badge tone="green">Disponible</Badge>;
  }
}
