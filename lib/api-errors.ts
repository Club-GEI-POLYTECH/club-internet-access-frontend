/**
 * Messages et détection d’erreurs « backend injoignable » (réseau, DNS, timeout, etc.).
 */

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Impossible de joindre le serveur d'API. Vérifiez qu'il est démarré (ex. http://localhost:4000) et que NEXT_PUBLIC_API_URL pointe vers la bonne URL dans .env.local."

export function isLikelyNetworkOrBackendDown(error: unknown): boolean {
  if (error == null) return false

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: string }).code || '')
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ERR_NETWORK', 'ECONNRESET'].includes(code)) {
      return true
    }
  }

  if (error instanceof TypeError) {
    const m = (error.message || '').toLowerCase()
    if (m.includes('fetch') || m.includes('failed to fetch') || m.includes('network')) return true
  }

  if (error instanceof DOMException && error.name === 'AbortError') return true

  const msg = String((error as Error)?.message ?? error).toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('etimedout') ||
    msg.includes('load failed') ||
    msg.includes('aborted')
  )
}

/** Transforme une erreur brute en Error lisible pour l’utilisateur. */
export function formatApiConnectionError(error: unknown): Error {
  if (isLikelyNetworkOrBackendDown(error)) {
    return new Error(BACKEND_UNAVAILABLE_MESSAGE)
  }
  if (error instanceof Error) return error
  return new Error(String(error))
}
