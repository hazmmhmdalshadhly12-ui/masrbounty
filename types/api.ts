export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'unexpected';

export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function err(error: string, code?: ApiErrorCode): ApiErr {
  return code ? { ok: false, error, code } : { ok: false, error };
}
