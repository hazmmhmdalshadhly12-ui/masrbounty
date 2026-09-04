'use client'
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function usePrograms(){return useQuery({queryKey:['use-programs'],queryFn:()=>api('/api/programs')})}
