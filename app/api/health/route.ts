export const runtime = 'edge';

/**
 * Minimal liveness probe. Returns only {healthy:true} — no env flags,
 * no timestamps, no error details (prevents config leakage & correlation).
 * Always 200 when the runtime itself is healthy; readiness of downstream
 * dependencies is intentionally not exposed here.
 */
export async function GET() {
  return Response.json({ healthy: true }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
