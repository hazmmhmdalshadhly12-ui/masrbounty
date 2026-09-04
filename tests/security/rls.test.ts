test('service key never in client bundle',()=>{const src=require('fs').readFileSync('lib/supabase/client.ts','utf8');expect(src).not.toMatch('SERVICE_ROLE')});
