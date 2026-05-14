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
