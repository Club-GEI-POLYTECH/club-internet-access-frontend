/** Pages où un rechargement vers `/login` effacerait le formulaire / les toasts. */
export const AUTH_PUBLIC_PATH_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password'] as const

export function isOnAuthPublicPage(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  return AUTH_PUBLIC_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

/** `401` attendu (identifiants invalides, etc.) — ne pas traiter comme session expirée. */
export function isAuthApiPathExpecting401(endpointOrPath: string): boolean {
  const p = endpointOrPath.toLowerCase()
  return (
    p.includes('/auth/login') ||
    p.includes('/auth/register/verify') ||
    p.includes('/auth/reset-password')
  )
}
