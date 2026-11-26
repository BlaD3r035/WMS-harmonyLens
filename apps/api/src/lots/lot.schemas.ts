import { z } from 'zod';
import { requiredText } from '../common/text.js';

export const lotQuerySchema = z.object({
  status: z.enum(['pendiente_revision', 'autorizado', 'rechazado']).optional(),
  q: z.string().trim().max(100).optional(),
  lensId: z.uuid().optional(),
});

export const rejectLotSchema = z.object({
  reason: requiredText('El motivo del rechazo', 500),
});

export const assignLocationSchema = z.object({
  locationId: z.uuid({ error: 'Ubicación no válida' }),
});

export type LotQuery = z.infer<typeof lotQuerySchema>;
export type RejectLotDto = z.infer<typeof rejectLotSchema>;
