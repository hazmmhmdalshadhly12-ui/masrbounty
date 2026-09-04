'use client'
export default function Err({error,reset}:{error:Error;reset:()=>void}){return <div className="p-8"><h2>Something went wrong</h2><p>{error.message}</p><button onClick={reset}>Retry</button></div>}
