/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// Strict CSP: same-origin + Supabase endpoints + no inline scripts (Next needs 'unsafe-inline' for styles only)
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'} wss://*.supabase.co`,
  "frame-ancestors 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ...(isProd ? [{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }] : []),
      ],
    },
  ],
};

module.exports = nextConfig;
