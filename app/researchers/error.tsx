'use client'
export default function Err({reset}:{reset:()=>void}){return <div className="p-8"><h2>Error in app/researchers</h2><button onClick={reset}>Retry</button></div>}
