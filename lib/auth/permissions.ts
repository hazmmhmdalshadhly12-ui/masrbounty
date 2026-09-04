export const PERMS={researcher:['report.create','report.read.own'],company:['program.manage','report.triage'],moderator:['dispute.review'],admin:['*']} as const;
export function can(role:string,p:string){const l=(PERMS as any)[role]||[];return l.includes('*')||l.includes(p)}
