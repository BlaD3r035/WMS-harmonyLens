import { z } from 'zod';
import { requiredText } from '../common/text.js';

// Multiples of 0.25 are exact in binary floating point, so this check is safe.
const isQuarterStep = (n: number) => Number.isInteger(n * 4);

const minStock = z
  .number({ error: 'El stock mínimo es obligatorio' })
  .int('Debe ser un número entero')
  .min(0, 'No puede ser negativo')
  .max(1_000_000);

export const createLensSchema = z.object({
  code: requiredText('El código', 40),
  description: requiredText('La descripción', 300),
  sphere: z
    .number({ error: 'La esfera es obligatoria' })
    .min(-4, 'La esfera debe estar entre -4.00 y +4.00')
    .max(4, 'La esfera debe estar entre -4.00 y +4.00')
    .refine(isQuarterStep, 'La esfera aumenta de 0.25 en 0.25'),
  cylinder: z
    .number({ error: 'El cilindro es obligatorio' })
    .min(-4, 'El cilindro debe estar entre -4.00 y 0.00')
    .max(0, 'El cilindro solo puede ser negativo (o 0.00)')
    .refine(isQuarterStep, 'El cilindro aumenta de 0.25 en 0.25'),
  minStock: minStock.default(0),
});

// Code and formula identify the reference and never change; only these do.
export const updateLensSchema = z
  .object({
    description: requiredText('La descripción', 300).optional(),
    minStock: minStock.optional(),
  })
  .refine((v) => v.description !== undefined || v.minStock !== undefined, {
    message: 'Nada que actualizar',
  });

export const lensQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type CreateLensDto = z.infer<typeof createLensSchema>;
export type UpdateLensDto = z.infer<typeof updateLensSchema>;
