/**
 * @type {import('next').NextConfig}
 * Production : définir NEXT_PUBLIC_API_URL (URL du backend ou `/api`).
 * Si NEXT_PUBLIC_API_URL=/api, définir API_URL vers l’URL complète du backend (rewrite serveur).
 * Voir `.env.example` et `.env.production.example`.
 */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || '/api',
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    const headers = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
    ]
    if (isProd) {
      headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      })
    }
    // CSP pragmatique : compatible Next.js (inline styles/scripts). À resserrer si aucun besoin unsafe-*.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: http: ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
    headers.push({ key: 'Content-Security-Policy', value: csp })
    return [{ source: '/:path*', headers }]
  },
  async rewrites() {
    const base = (process.env.API_URL || 'http://localhost:4000/api').replace(/\/$/, '')
    const destination = base.endsWith('/:path*') ? base : `${base}/:path*`
    return [
      {
        source: '/api/:path*',
        destination,
      },
    ]
  },
}

module.exports = nextConfig
