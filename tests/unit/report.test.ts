import { reportSchema } from '@/schemas/report';
test('report validation rejects short title',()=>{expect(()=>reportSchema.parse({program_id:'00000000-0000-0000-0000-000000000000',title:'short',summary:'x'.repeat(25),vulnerability_type:'xss',severity:'high',affected_asset:'a',description:'d'.repeat(35),impact:'i'.repeat(25),reproduction_steps:'r'.repeat(25)})).toThrow()});
