'use client'
import { useQuery } from '@tanstack/react-query';
export function usePrograms(){return useQuery({queryKey:['programs'],queryFn:async()=>[]})}
