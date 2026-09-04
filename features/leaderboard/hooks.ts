'use client'
import { useQuery } from '@tanstack/react-query';
export function useLeaderboard(){return useQuery({queryKey:['leaderboard'],queryFn:async()=>[]})}
