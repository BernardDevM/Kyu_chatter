import type { TransformFnParams } from 'class-transformer';

/**
 * Transforms string values by trimming whitespace. Leaves non-strings intact.
 */
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
