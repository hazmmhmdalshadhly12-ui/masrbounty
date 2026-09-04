'use client'
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export function useNotifications(){return useQuery({queryKey:['use-notifications'],queryFn:()=>api('/api/notifications')})}
