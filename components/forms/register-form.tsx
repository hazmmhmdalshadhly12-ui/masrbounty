'use client'
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@/schemas/auth';
export function RegisterForm(){const f=useForm({resolver:zodResolver(registerSchema)});return <form onSubmit={f.handleSubmit(async()=>{})}><button>Register</button></form>}
