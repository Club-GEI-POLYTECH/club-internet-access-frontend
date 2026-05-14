import { isAxiosError } from 'axios'

const RATE_LIMIT_DEFAULT =
  'Trop de tentatives ou trop de requêtes. Patientez quelques minutes avant de réessayer.'

/** Détecte un 429 (Axios) ou un message issu de `apiRequest` après throttling. */
export function isAuthRateLimitError(error: unknown): boolean {
  if (isAxiosError(error) && error.response?.status === 429) return true
  if (error instanceof Error) {
    const m = error.message.toLowerCase()
    return (
      m.includes('429') ||
      m.includes('trop de tentatives') ||
      m.includes('too many requests') ||
      m.includes('limite côté serveur')
    )
  }
  return false
}

/** Texte affichable pour un throttling (corps de toast / formulaire). */
export function getAuthRateLimitMessage(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 429) {
    const api = error.response?.data as { message?: string | string[] } | undefined
    const raw = api?.message
    const fromApi = Array.isArray(raw) ? raw.join(', ') : raw
    if (fromApi && String(fromApi).trim()) return String(fromApi).trim()
    const em = error.message?.trim()
    if (em && em !== 'Request failed with status code 429') return em
    return RATE_LIMIT_DEFAULT
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return RATE_LIMIT_DEFAULT
}

/** Titre + corps pour la page de connexion (ne pas confondre 429 avec identifiants invalides). */
export function getLoginErrorToast(error: unknown): { title: string; body: string } {
  if (isAuthRateLimitError(error)) {
    return { title: 'Limite de requêtes', body: getAuthRateLimitMessage(error) }
  }
  if (isAxiosError(error)) {
    const raw = error.response?.data as { message?: string | string[] } | undefined
    const m = raw?.message
    const fromApi = Array.isArray(m) ? m.join(', ') : m
    if (fromApi && String(fromApi).trim()) {
      return { title: 'Connexion refusée', body: String(fromApi).trim() }
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return { title: 'Connexion refusée', body: error.message.trim() }
  }
  return {
    title: 'Connexion refusée',
    body: 'Vérifiez votre e-mail et votre mot de passe.',
  }
}
