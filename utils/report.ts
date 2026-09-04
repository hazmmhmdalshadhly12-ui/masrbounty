export const badgeColor=(s:string)=>({critical:'bg-red-500',high:'bg-orange-500',medium:'bg-yellow-500',low:'bg-blue-500',informational:'bg-gray-500'} as Record<string,string>)[s]||'bg-gray-500';
export const canTransition=(from:string,to:string)=>!((from==='closed'&&to!=='closed'));
