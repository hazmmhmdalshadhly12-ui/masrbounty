'use client'
import { useQuery } from '@tanstack/react-query';
export function useMessaging(){return useQuery({queryKey:['messaging'],queryFn:async()=>[]})}
