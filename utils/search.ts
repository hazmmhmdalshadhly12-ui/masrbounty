/** Escape LIKE wildcards so user search text matches literally. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}
