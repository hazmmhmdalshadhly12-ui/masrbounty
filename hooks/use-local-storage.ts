'use client'
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function useLocalStorage(){return useQuery({queryKey:['use-local-storage'],queryFn:()=>api('/api/key')})}
