'use client'
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function useWallet(){return useQuery({queryKey:['use-wallet'],queryFn:()=>api('/api/wallet')})}
