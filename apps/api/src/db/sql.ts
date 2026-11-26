/** Builds a `%term%` ILIKE pattern with LIKE wildcards in the input escaped. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}
