'use client'
import { useQuery } from '@tanstack/react-query';
export function useAdmin(){return useQuery({queryKey:['admin'],queryFn:async()=>[]})}
