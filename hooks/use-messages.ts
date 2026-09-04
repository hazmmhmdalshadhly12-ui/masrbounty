'use client'
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function useMessages(){return useQuery({queryKey:['use-messages'],queryFn:()=>api('/api/messages')})}
