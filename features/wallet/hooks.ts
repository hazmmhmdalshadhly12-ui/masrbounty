'use client'
import { useQuery } from '@tanstack/react-query';
export function useWallet(){return useQuery({queryKey:['wallet'],queryFn:async()=>[]})}
