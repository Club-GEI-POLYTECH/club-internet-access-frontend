import type { TicketType } from '@/types/api'

/**
 * Texte d’exemple pour les champs montant : dérivé des prix des types actifs (API / DB).
 */
export function ticketTypesPricePlaceholder(types: TicketType[]): string {
  const active = types.filter((t) => t.isActive)
  if (active.length === 0) return ''

  return active
    .slice()
    .sort((a, b) => a.price - b.price)
    .map((t) => `${t.price.toLocaleString('fr-FR')} CDF (${t.name})`)
    .join(' · ')
}
