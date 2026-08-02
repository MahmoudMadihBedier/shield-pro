// Single place to turn a caught `unknown` into a user-facing message and a
// console entry, so every catch block does the same thing instead of each
// component picking its own shape (some used console.error, most didn't).

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function logError(context: string, err: unknown): void {
  console.error(`[${context}]`, err);
}

export function handleError(context: string, err: unknown, fallback: string): string {
  logError(context, err);
  return getErrorMessage(err, fallback);
}
