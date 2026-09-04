import fs from 'fs';

test('CSP header is configured', () => {
  const src = fs.readFileSync('next.config.js', 'utf8');
  expect(src).toMatch('Content-Security-Policy');
  expect(src).toMatch('X-Content-Type-Options');
  expect(src).toMatch('Strict-Transport-Security');
});

test('no wildcard CORS with credentials on API', () => {
  const src = fs.readFileSync('next.config.js', 'utf8');
  expect(src).not.toMatch('Access-Control-Allow-Origin');
});

test('middleware enforces CSRF check on api writes', () => {
  const src = fs.readFileSync('middleware.ts', 'utf8');
  expect(src).toMatch('csrfBlocked');
  expect(src).toMatch('/api/');
});
