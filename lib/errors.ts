/** Shared application error type + message extraction. Pure. */

export class AppError extends Error {
  code: string;
  status: number;
  constructor(m: string, code = 'ERR', status = 400) {
    super(m);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : 'Unexpected error');

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function statusFromError(e: unknown): number {
  if (e instanceof AppError) return e.status;
  return 500;
}

export function toAppError(e: unknown, fallback = 'Unexpected error'): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof Error) return new AppError(e.message || fallback);
  return new AppError(fallback);
}
