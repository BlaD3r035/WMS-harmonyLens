import { z } from 'zod';
import { optionalText, requiredText } from '../common/text.js';

const positiveInt = (label: string) =>
  z
    .number({ error: `${label} es obligatoria` })
    .int('Debe ser un número entero')
    .min(1, 'Debe ser mayor a 0')
    .max(1_000_000, 'Valor demasiado grande');

const lotLineSchema = z.object({
  lensId: z.uuid({ error: 'Selecciona una referencia' }),
  lotNumber: requiredText('El lote', 60),
  invimaRegistration: requiredText('El registro INVIMA', 60),
  boxCount: positiveInt('La cantidad de cajas'),
  quantity: positiveInt('La cantidad de lentes'),
  qualityNotes: optionalText(500),
  locationId: z
    .uuid({ error: 'Ubicación no válida' })
    .nullish()
    .transform((v) => v ?? null),
});

export const createImportSchema = z
  .object({
    distributor: requiredText('El distribuidor', 120),
    invoiceNumber: optionalText(60),
    manufacturer: optionalText(120),
    notes: optionalText(500),
    lots: z
      .array(lotLineSchema, { error: 'Agrega al menos un lote' })
      .min(1, 'Agrega al menos un lote')
      .max(200),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.lots.forEach((lot, index) => {
      const key = lot.lotNumber.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lots', index, 'lotNumber'],
          message: 'Lote repetido en esta importación',
        });
      }
      seen.add(key);
    });
  });

export type CreateImportDto = z.infer<typeof createImportSchema>;
