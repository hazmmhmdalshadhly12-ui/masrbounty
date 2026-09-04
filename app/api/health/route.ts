export const runtime = 'edge';

export async function GET(){return Response.json({healthy:true,ts:new Date().toISOString()})}
