import { uuid, pagination, emailSchema, slugField, egyptianPhoneSchema } from '@/lib/validation';

test('uuid accepts v4 and rejects garbage', () => {
  expect(uuid.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(true);
  expect(uuid.safeParse('not-a-uuid').success).toBe(false);
});

test('pagination defaults and clamps', () => {
  expect(pagination.parse({})).toEqual({ page: 1, per: 20 });
  expect(pagination.parse({ page: '3', per: '10' })).toEqual({ page: 3, per: 10 });
  expect(() => pagination.parse({ page: 0 })).toThrow();
  expect(() => pagination.parse({ per: 500 })).toThrow();
});

test('email schema lowercases and validates', () => {
  expect(emailSchema.parse('Hunter@Example.COM')).toBe('hunter@example.com');
  expect(() => emailSchema.parse('nope')).toThrow();
});

test('slug field enforces kebab-case', () => {
  expect(slugField.parse('my-program')).toBe('my-program');
  expect(() => slugField.parse('ab')).toThrow();
  expect(() => slugField.parse('BAD SLUG')).toThrow();
});

test('egyptian phone accepts 01xxxxxxxxx, empty means undefined', () => {
  expect(egyptianPhoneSchema.parse('01012345678')).toBe('01012345678');
  expect(egyptianPhoneSchema.parse('')).toBeUndefined();
  expect(egyptianPhoneSchema.parse(undefined)).toBeUndefined();
  expect(() => egyptianPhoneSchema.parse('123')).toThrow();
});
