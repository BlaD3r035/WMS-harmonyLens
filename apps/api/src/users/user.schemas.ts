import { z } from 'zod';

export const ROLE_VALUES = [
  'director_tecnico',
  'asesor_punto_venta',
  'admin_puntos_venta',
  'jefe_almacen',
  'auxiliar_bodega',
  'admin',
] as const;

const email = z
  .string({ error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .max(254, 'Correo demasiado largo')
  .pipe(z.email('Correo no válido'));

export const loginSchema = z.object({
  email,
  // bcrypt only uses the first 72 bytes; reject longer input instead of truncating.
  password: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria')
    .max(72),
});

export const registerSchema = z.object({
  fullName: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre es obligatorio')
    .max(120),
  email,
  password: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(8, 'Mínimo 8 caracteres')
    .max(72, 'Máximo 72 caracteres'),
  role: z.enum(ROLE_VALUES, { error: 'Rol no válido' }),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
