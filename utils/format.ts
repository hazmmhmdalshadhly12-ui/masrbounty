export const fmtEGP=(n:number)=>new Intl.NumberFormat('ar-EG',{style:'currency',currency:'EGP'}).format(n);
export const fmtDate=(d:string)=>new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'}).format(new Date(d));
export const shortId=(s:string)=>s.slice(0,8);
