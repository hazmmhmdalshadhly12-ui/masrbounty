'use client'
import { useQuery } from '@tanstack/react-query';
export function useNotifications(){return useQuery({queryKey:['notifications'],queryFn:async()=>[]})}
