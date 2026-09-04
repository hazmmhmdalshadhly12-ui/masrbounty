'use client'
import { useQuery } from '@tanstack/react-query';
export function useCompany(){return useQuery({queryKey:['company'],queryFn:async()=>[]})}
