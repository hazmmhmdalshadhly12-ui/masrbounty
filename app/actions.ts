'use server'
import { z } from 'zod';
export async function noopAction(input: unknown){return {ok:true,input};}
