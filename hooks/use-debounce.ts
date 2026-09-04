'use client'
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function useDebounce(){return useQuery({queryKey:['use-debounce'],queryFn:()=>api('/api/value')})}
