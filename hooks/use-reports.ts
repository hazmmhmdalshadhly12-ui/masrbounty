'use client'
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function useReports(){return useQuery({queryKey:['use-reports'],queryFn:()=>api('/api/reports')})}
