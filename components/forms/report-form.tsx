'use client'
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reportSchema } from '@/schemas/report';
import { api } from '@/lib/api';
export function ReportForm({programId}:{programId:string}){const f=useForm({resolver:zodResolver(reportSchema)});return <form onSubmit={f.handleSubmit((d)=>api('/api/reports',{method:'POST',body:JSON.stringify({...d,program_id:programId})}))}><button>Create report</button></form>}
