'use client'
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function useReputation(){return useQuery({queryKey:['use-reputation'],queryFn:()=>api('/api/reputation')})}
