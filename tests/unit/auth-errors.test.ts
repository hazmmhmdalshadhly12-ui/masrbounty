import { friendlyAuthError } from '@/lib/auth/errors';

test('maps unconfirmed email', () => {
  expect(friendlyAuthError('Email not confirmed')).toMatch('تأكيد البريد');
});

test('maps invalid credentials', () => {
  expect(friendlyAuthError('Invalid login credentials')).toMatch('غير صحيحة');
});

test('maps rate limits', () => {
  expect(friendlyAuthError('You have exceeded the email sending limit')).toMatch('10 دقائق');
  expect(friendlyAuthError('over_email_send_rate_limit exceeded')).toMatch('10 دقائق');
});

test('maps duplicates', () => {
  expect(friendlyAuthError('duplicate key value')).toMatch('مسجل بالفعل');
});

test('falls back to generic message', () => {
  expect(friendlyAuthError('something totally unknown')).toMatch('حدث خطأ');
});
