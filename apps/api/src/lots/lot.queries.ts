import type { Lot, LotStatus } from '@harmonylens/shared';

export interface LotRow {
  id: string;
  lot_number: string;
  status: LotStatus;
  distributor: string | null;
  invoice_number: string | null;
  invima_registration: string;
  box_count: number;
  quantity_received: number;
  quantity: number;
  quality_notes: string | null;
  received_at: Date;
  lens_id: string;
  lens_code: string;
  lens_description: string;
  sphere: number;
  cylinder: number;
  location_id: string | null;
  location_code: string | null;
  decided_at: Date | null;
  decided_by_name: string | null;
  rejection_reason: string | null;
}

/** Lot with its lens, import, location, stock and reviewer. Append a WHERE clause. */
export const LOT_SELECT = `
  SELECT l.id, l.lot_number, l.status, i.distributor, i.invoice_number,
         l.invima_registration, l.box_count, l.quantity_received,
         COALESCE(inv.quantity, 0)::int AS quantity,
         l.quality_notes, l.received_at,
         l.lens_id, le.code AS lens_code, le.description AS lens_description,
         le.sphere, le.cylinder,
         l.location_id, loc.code AS location_code,
         l.decided_at, du.full_name AS decided_by_name, l.rejection_reason
  FROM lots l
  JOIN lenses le ON le.id = l.lens_id
  LEFT JOIN imports i ON i.id = l.import_id
  LEFT JOIN lot_inventory inv ON inv.lot_id = l.id
  LEFT JOIN warehouse_locations loc ON loc.id = l.location_id
  LEFT JOIN users du ON du.id = l.decided_by`;

export const toLot = (r: LotRow): Lot => ({
  id: r.id,
  lotNumber: r.lot_number,
  status: r.status,
  distributor: r.distributor,
  invoiceNumber: r.invoice_number,
  invimaRegistration: r.invima_registration,
  boxCount: r.box_count,
  quantityReceived: r.quantity_received,
  quantity: r.quantity,
  qualityNotes: r.quality_notes,
  receivedAt: r.received_at.toISOString(),
  lensId: r.lens_id,
  lensCode: r.lens_code,
  lensDescription: r.lens_description,
  sphere: r.sphere,
  cylinder: r.cylinder,
  locationId: r.location_id,
  locationCode: r.location_code,
  decidedAt: r.decided_at?.toISOString() ?? null,
  decidedByName: r.decided_by_name,
  rejectionReason: r.rejection_reason,
});
