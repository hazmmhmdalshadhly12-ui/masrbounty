import { friendlyActionError } from '@/components/programs/program-builder/action-errors';

describe('friendlyActionError', () => {
  it('translates the stale-build Server Action error into Arabic refresh guidance', () => {
    const msg = 'Server Action "6058e08b2cccd67dc5429d5be9a89f7a1bdc9f4b" was not found on the server';
    const out = friendlyActionError(new Error(msg));
    expect(out).toContain('F5');
    expect(out).toContain('المسودة');
  });

  it('matches case-insensitively and non-Error values', () => {
    expect(friendlyActionError('Failed to find Server Action "abc"')).toContain('F5');
    expect(friendlyActionError(new Error('MISSING SERVER ACTION xyz'))).toContain('F5');
  });

  it('translates network failures', () => {
    expect(friendlyActionError(new Error('fetch failed'))).toContain('الاتصال');
    expect(friendlyActionError(new Error('Failed to fetch'))).toContain('الاتصال');
  });

  it('passes through ordinary server messages untouched', () => {
    expect(friendlyActionError(new Error('الدومين غير صالح'))).toBe('الدومين غير صالح');
  });

  it('falls back for empty/unknown input', () => {
    expect(friendlyActionError(null)).toBe('خطأ غير متوقع — أعد المحاولة');
    expect(friendlyActionError(undefined)).toBe('خطأ غير متوقع — أعد المحاولة');
  });
});
