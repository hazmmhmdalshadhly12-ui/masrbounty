export const runtime = 'edge';

export async function GET() {
  const body = [
    'Contact: mailto:security@masrbounty.com',
    'Expires: 2027-12-31T23:59:59.000Z',
    'Preferred-Languages: ar, en',
    'Policy: https://masrbounty.online/security',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'max-age=86400' },
  });
}
