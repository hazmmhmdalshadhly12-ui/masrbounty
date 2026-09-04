'use client'
import { useQuery } from '@tanstack/react-query';
export function useBadges(){return useQuery({queryKey:['badges'],queryFn:async()=>[]})}
