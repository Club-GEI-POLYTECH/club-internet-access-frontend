/**
 * Libellés et messages affichés à l’utilisateur (toasts, formulaires, erreurs).
 */

export const USER_CONNECTION_ERROR =
  'Connexion au service impossible. Vérifiez votre réseau et réessayez dans quelques instants.'

export const USER_SERVICE_UNAVAILABLE =
  'Le service est temporairement indisponible. Réessayez dans quelques minutes.'

export const USER_INVALID_RESPONSE =
  'Réponse inattendue du service. Réessayez dans quelques instants.'

export const USER_RATE_LIMIT =
  'Trop de tentatives. Patientez quelques instants avant de réessayer.'

export const USER_GENERIC_ERROR =
  'Une erreur est survenue. Réessayez ou contactez le support si le problème persiste.'

const TECHNICAL_PATTERNS: Array<{ test: RegExp; message: string }> = [
  { test: /failed to fetch|network|econnrefused|enotfound|etimedout|load failed/i, message: USER_CONNECTION_ERROR },
  { test: /serveur d'api|backend|next_public_api|localhost:\d+|json attendu|logs du backend/i, message: USER_SERVICE_UNAVAILABLE },
  { test: /ticketid|paymentid|transactionid|merchantreference|uuid|get \/|post \/|jwt|polling/i, message: USER_GENERIC_ERROR },
  { test: /429|trop de tentatives|too many requests|limite côté serveur/i, message: USER_RATE_LIMIT },
  { test: /^erreur \d{3}$/i, message: USER_GENERIC_ERROR },
]

/** Statut de paiement → libellé français. */
export function paymentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'En attente',
    processing: 'En cours',
    success: 'Réussi',
    completed: 'Complété',
    failed: 'Échoué',
    cancelled: 'Annulé',
    expired: 'Expiré',
  }
  return map[status.toLowerCase()] ?? 'Statut inconnu'
}

/** Message d’erreur API ou exception → texte affichable sans jargon technique. */
export function toUserErrorMessage(error: unknown, fallback = USER_GENERIC_ERROR): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof (error as { message?: unknown }).message === 'string'
          ? String((error as { message: string }).message)
          : ''

  const trimmed = raw.trim()
  if (!trimmed) return fallback

  for (const { test, message } of TECHNICAL_PATTERNS) {
    if (test.test(trimmed)) return message
  }

  if (trimmed.length > 200 || /[{[\]}/\\]/.test(trimmed)) return fallback

  return trimmed
}

/** Sous-titre lisible pour un forfait (masque les profils routeur type DURATION_30J). */
export function formatTicketTypeSubtitle(type: {
  profile?: string
  timeLimit?: string
  dataLimit?: string
}): string | null {
  const parts: string[] = []
  if (type.timeLimit?.trim()) {
    parts.push(`Durée : ${type.timeLimit.trim()}`)
  }
  if (type.dataLimit?.trim()) {
    parts.push(`Données : ${type.dataLimit.trim()}`)
  }
  if (parts.length > 0) return parts.join(' · ')

  const profile = (type.profile ?? '').trim()
  if (!profile) return null
  if (/^DURATION_/i.test(profile) || /^[A-Z][A-Z0-9_]{2,}$/.test(profile)) return null
  return profile
}
