import { loginSchema } from '@/schemas/auth';
test('login ok',()=>{expect(loginSchema.parse({email:'a@b.com',password:'12345678'}).email).toBe('a@b.com')});
