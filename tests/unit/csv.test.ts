import { toCSV } from '@/utils/csv';
test('csv',()=>{expect(toCSV([{a:1}])).toContain('a')});
