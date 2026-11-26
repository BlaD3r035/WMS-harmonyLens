// Shared API contract between apps/api and apps/client.
// Types only: no runtime values, so the API can import them with `import type`.

export type UserRole =
  | 'director_tecnico'
  | 'asesor_punto_venta'
  | 'admin_puntos_venta'
  | 'jefe_almacen'
  | 'auxiliar_bodega'
  | 'admin';

export type LotStatus = 'pendiente_revision' | 'autorizado' | 'rechazado';

/** `agotada`: no units in authorized lots. `bajo`: at or below minimum stock. */
export type StockState = 'agotada' | 'bajo' | 'ok';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface UserSummary extends AuthUser {
  isActive: boolean;
  createdAt: string;
}

export interface Lens {
  id: string;
  code: string;
  description: string;
  /** -4.00 to 4.00 in 0.25 steps. */
  sphere: number;
  /** -4.00 to 0.00 in 0.25 steps (never positive). */
  cylinder: number;
  minStock: number;
}

export interface WarehouseLocation {
  id: string;
  code: string;
  description: string | null;
}

export interface Lot {
  id: string;
  lotNumber: string;
  status: LotStatus;
  distributor: string | null;
  invoiceNumber: string | null;
  invimaRegistration: string;
  boxCount: number;
  quantityReceived: number;
  /** Units currently in the warehouse for this lot. */
  quantity: number;
  qualityNotes: string | null;
  receivedAt: string;
  lensId: string;
  lensCode: string;
  lensDescription: string;
  sphere: number;
  cylinder: number;
  locationId: string | null;
  locationCode: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  rejectionReason: string | null;
}

export interface ImportSummary {
  id: string;
  distributor: string;
  invoiceNumber: string | null;
  manufacturer: string | null;
  notes: string | null;
  receivedAt: string;
  createdByName: string | null;
  lotCount: number;
  totalUnits: number;
}

export interface ImportDetail extends ImportSummary {
  lots: Lot[];
}

export interface InventoryReference {
  lensId: string;
  code: string;
  description: string;
  sphere: number;
  cylinder: number;
  minStock: number;
  /** Units in authorized lots. */
  available: number;
  /** Units in lots waiting for review. */
  quarantine: number;
  state: StockState;
}

export interface ApiError {
  statusCode: number;
  message: string;
  /** Field-level validation messages, keyed by field path (e.g. `lots.0.boxCount`). */
  errors?: Record<string, string>;
}
