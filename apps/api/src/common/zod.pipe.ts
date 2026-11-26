import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Validates a request part against a zod schema; replies 400 with per-field messages. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) {
      return result.data;
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      errors[key] ??= issue.message;
    }
    throw new BadRequestException({
      statusCode: 400,
      message: 'Hay datos inválidos en la solicitud',
      errors,
    });
  }
}
