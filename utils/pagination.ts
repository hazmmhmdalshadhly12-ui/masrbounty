export function paginate<T>(a:T[],page=1,per=20){return a.slice((page-1)*per,page*per)}
