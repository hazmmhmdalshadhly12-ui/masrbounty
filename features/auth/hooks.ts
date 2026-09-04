'use client'
import { useQuery } from '@tanstack/react-query';
export function useAuth(){return useQuery({queryKey:['auth'],queryFn:async()=>[]})}
