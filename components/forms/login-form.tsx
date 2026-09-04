'use client'
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@/schemas/auth';
export function LoginForm(){const f=useForm({resolver:zodResolver(loginSchema)});return <form onSubmit={f.handleSubmit(async()=>{})}><input {...f.register('email')} placeholder="email"/><input {...f.register('password')} type="password" placeholder="password"/><button>Login</button></form>}
