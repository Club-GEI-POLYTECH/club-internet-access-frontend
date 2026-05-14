/**
 * Réduit le risque d’open redirect : n’accepte que des chemins relatifs sur la même origine
 * (pas de `//`, pas de schéma, pas de caractères de contrôle).
 */

const REDIRECT_CHECK_ORIGIN = 'https://redirect-check.invalid'

export function getSafeInternalRedirect(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('/') || t.startsWith('//')) return null
  if (/[\u0000-\u001F\u007F]/.test(t)) return null
  try {
    const u = new URL(t, REDIRECT_CHECK_ORIGIN)
    if (u.origin !== REDIRECT_CHECK_ORIGIN) return null
    const out = u.pathname + u.search + u.hash
    if (!out.startsWith('/')) return null
    return out
  } catch {
    return null
  }
}

export function getSafeRedirectPath(raw: string | null | undefined, fallback: string): string {
  return getSafeInternalRedirect(raw) ?? fallback
}
