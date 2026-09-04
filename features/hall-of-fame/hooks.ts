'use client'
import { useQuery } from '@tanstack/react-query';
export function useHallOfFame(){return useQuery({queryKey:['hall-of-fame'],queryFn:async()=>[]})}
