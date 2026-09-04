'use client'
import { useQuery } from '@tanstack/react-query';
export function useReports(){return useQuery({queryKey:['reports'],queryFn:async()=>[]})}
