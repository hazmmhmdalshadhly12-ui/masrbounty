import { loginSchema, registerSchema } from '@/schemas/auth';

test('login ok', () => {
  expect(loginSchema.parse({ email: 'a@b.com', password: '12345678' }).email).toBe('a@b.com');
});

test('login rejects bad email and short password', () => {
  expect(() => loginSchema.parse({ email: 'nope', password: '12345678' })).toThrow();
  expect(() => loginSchema.parse({ email: 'a@b.com', password: 'short' })).toThrow();
});

test('register accepts a full egyptian researcher payload', () => {
  const out = registerSchema.parse({
    username: 'hunter_eg',
    email: 'hunter@example.com',
    password: 'S3curePass!',
    confirmPassword: 'S3curePass!',
    full_name: 'Ahmed Ali',
    phone: '01012345678',
    role: 'researcher',
  });
  expect(out.role).toBe('researcher');
});

test('register rejects mismatched passwords', () => {
  expect(() =>
    registerSchema.parse({
      username: 'hunter_eg',
      email: 'hunter@example.com',
      password: 'S3curePass!',
      confirmPassword: 'Different1!',
      role: 'researcher',
    }),
  ).toThrow();
});

test('register rejects bad phone and unknown role', () => {
  expect(() =>
    registerSchema.parse({
      username: 'hunter_eg',
      email: 'hunter@example.com',
      password: 'S3curePass!',
      confirmPassword: 'S3curePass!',
      phone: '123',
      role: 'researcher',
    }),
  ).toThrow();
  expect(() =>
    registerSchema.parse({
      username: 'hunter_eg',
      email: 'hunter@example.com',
      password: 'S3curePass!',
      confirmPassword: 'S3curePass!',
      role: 'root',
    }),
  ).toThrow();
});
