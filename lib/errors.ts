export class AppError extends Error{constructor(m:string,public code='ERR',public status=400){super(m)}};
export const errMsg=(e:unknown)=>e instanceof Error?e.message:'Unexpected error';
