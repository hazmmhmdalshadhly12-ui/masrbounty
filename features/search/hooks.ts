'use client'
import { useQuery } from '@tanstack/react-query';
export function useSearch(){return useQuery({queryKey:['search'],queryFn:async()=>[]})}
