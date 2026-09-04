export async function GET(){return Response.json({ok:true,api:'reports/[id]'})}
export async function POST(req:Request){const b=await req.json().catch(()=>({}));return Response.json({ok:true,data:b})}
