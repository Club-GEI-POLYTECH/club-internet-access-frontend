import {
  extractTicketUsernameFromNotes,
  getPaymentForfaitLabel,
  getPaymentTicketUsername,
} from '@/lib/normalize-payment-list'
import type { Payment, UserWithPayments } from '@/types/api'

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase()
}

function haystackIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle)
}

/** Recherche locale (page courante) — l’API n’accepte pas le paramètre `search`. */
export function filterUsers(items: UserWithPayments[], query: string): UserWithPayments[] {
  const needle = normalizeQuery(query)
  if (!needle) return items

  return items.filter((u) => {
    const parts = [
      u.firstName,
      u.lastName,
      u.email,
      u.phone,
      `${u.firstName ?? ''} ${u.lastName ?? ''}`,
    ]
    return parts.some((p) => p && haystackIncludes(String(p), needle))
  })
}

function profileSearchTokens(profile?: string): string[] {
  if (!profile) return []
  const raw = profile.trim()
  const lower = raw.toLowerCase()
  return [raw, lower, lower.replace(/_/g, ' '), lower.replace(/_/g, '')]
}

/** Texte indexé pour la recherche paiements (client, forfait, références). */
export function paymentSearchBlob(payment: Payment): string {
  const by = payment.createdBy
  const ticket = payment.ticket
  const forfaitLabel = getPaymentForfaitLabel(payment)
  const login = getPaymentTicketUsername(payment)

  const chunks: Array<string | undefined> = [
    payment.transactionId,
    payment.merchantReference,
    payment.phoneNumber,
    payment.notes,
    payment.ticketId,
    payment.createdById,
    ticket?.username,
    ticket?.profile,
    forfaitLabel ?? undefined,
    login,
    extractTicketUsernameFromNotes(payment.notes),
    by?.email,
    by?.firstName,
    by?.lastName,
    by?.phone,
    by ? `${by.firstName ?? ''} ${by.lastName ?? ''}`.trim() : undefined,
    ...profileSearchTokens(ticket?.profile),
  ]

  return chunks
    .filter((c): c is string => c != null && String(c).trim() !== '')
    .join('\n')
    .toLowerCase()
}

export function filterPayments(items: Payment[], query: string): Payment[] {
  const needle = normalizeQuery(query)
  if (!needle) return items

  return items.filter((p) => haystackIncludes(paymentSearchBlob(p), needle))
}
