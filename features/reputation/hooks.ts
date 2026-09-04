'use client'
import { useQuery } from '@tanstack/react-query';
export function useReputation(){return useQuery({queryKey:['reputation'],queryFn:async()=>[]})}
