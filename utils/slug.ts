export const slugify=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06FF]+/g,'-').replace(/-+/g,'-');
