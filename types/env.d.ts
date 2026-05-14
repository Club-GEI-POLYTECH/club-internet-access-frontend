declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * URL de base de l’API pour le client (fetch / axios).
     * Ex. `https://api.example.com/api` ou `/api` si proxy Next.
     */
    NEXT_PUBLIC_API_URL?: string
    /**
     * Cible du rewrite `source: /api/:path*` dans next.config.js (serveur uniquement).
     * Ex. `https://api.example.com/api` — pas besoin si NEXT_PUBLIC_API_URL pointe déjà vers l’API absolue.
     */
    API_URL?: string
    /** Alias historique ; préférer NEXT_PUBLIC_API_URL. */
    VITE_API_URL?: string
  }
}
