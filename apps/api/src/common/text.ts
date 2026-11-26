import { z } from 'zod';

/** Optional free text: trimmed, blank becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullish()
    .transform((value) => value || null);

export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} es obligatorio` })
    .trim()
    .min(1, `${label} es obligatorio`)
    .max(max, `Máximo ${max} caracteres`);
