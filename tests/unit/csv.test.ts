import { toCSV } from '@/utils/csv';

test('csv', () => {
  expect(toCSV([{ a: 1 }])).toContain('a');
});

test('emits header + rows for simple records', () => {
  expect(toCSV([{ a: 1, b: 2 }, { a: 3, b: 4 }])).toBe('a,b\n1,2\n3,4');
});

test('returns empty string for no rows', () => {
  expect(toCSV([])).toBe('');
});

test('quotes cells containing commas, quotes, or newlines', () => {
  expect(toCSV([{ name: 'a,b', note: 'say "hi"' }])).toBe('name,note\n"a,b","say ""hi"""');
  expect(toCSV([{ v: 'line1\nline2' }])).toBe('v\n"line1\nline2"');
});

test('renders null/undefined as empty cells', () => {
  expect(toCSV([{ a: null, b: undefined, c: 0 }])).toBe('a,b,c\n,,0');
});
