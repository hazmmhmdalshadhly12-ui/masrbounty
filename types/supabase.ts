export type Json=string|number|boolean|null|{[k:string]:Json}|Json[];
export interface Database{ public:{ Tables:{ profiles:{ Row:{ id:string;username:string } } } } }
