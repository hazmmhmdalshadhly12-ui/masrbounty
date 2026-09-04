import { getUser } from './get-user';
export async function requireUser(){const u=await getUser();if(!u) throw new Error('Unauthorized');return u}
