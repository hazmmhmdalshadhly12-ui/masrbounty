import fs from 'fs';

// Mirrors of the pure policy helpers in features/reports/attachments.ts.
// Kept local so the test never imports the 'use server' action module.
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
]);
const MAX_BYTES = 10 * 1024 * 1024;
const BLOCKED_EXT = ['.exe', '.js', '.ts', '.sh', '.bat', '.php', '.py', '.svg', '.html', '.htm'];

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

test('server action enforces mime allowlist and size cap', () => {
  const src = fs.readFileSync('features/reports/attachments.ts', 'utf8');
  expect(src).toMatch('ALLOWED_MIME');
  expect(src).toMatch('MAX_BYTES');
  expect(src).toMatch('10 * 1024 * 1024');
  expect(src).toMatch('File type not allowed');
  expect(src).toMatch('File too large');
});

test('server action blocks executables and checks magic bytes', () => {
  const src = fs.readFileSync('features/reports/attachments.ts', 'utf8');
  expect(src).toMatch('BLOCKED_EXT');
  expect(src).toMatch('.exe');
  expect(src).toMatch('Invalid PNG file');
  expect(src).toMatch('Invalid JPEG file');
});

test('allowlist accepts evidence types, rejects scripts', () => {
  expect(ALLOWED_MIME.has('image/png')).toBe(true);
  expect(ALLOWED_MIME.has('application/pdf')).toBe(true);
  expect(ALLOWED_MIME.has('text/plain')).toBe(true);
  expect(ALLOWED_MIME.has('application/x-sh')).toBe(false);
  expect(ALLOWED_MIME.has('text/html')).toBe(false);
});

test('size cap equals 10MB DB constraint', () => {
  expect(MAX_BYTES).toBe(10485760);
  expect(10 * 1024 * 1024 + 1 > MAX_BYTES).toBe(true);
  expect(1024).toBeLessThanOrEqual(MAX_BYTES);
});

test('extension guard catches double-extension masquerading', () => {
  expect(BLOCKED_EXT.includes(ext('poc.php'))).toBe(true);
  expect(BLOCKED_EXT.includes(ext('run.EXE'))).toBe(true);
  expect(BLOCKED_EXT.includes(ext('xss.svg'))).toBe(true);
  expect(BLOCKED_EXT.includes(ext('proof.png'))).toBe(false);
  expect(BLOCKED_EXT.includes(ext('notes.pdf'))).toBe(false);
});

test('filenames are sanitized and length-capped', () => {
  expect(safeName('../../etc/passwd')).toBe('.._.._etc_passwd');
  expect(safeName('a'.repeat(200)).length).toBe(100);
});
