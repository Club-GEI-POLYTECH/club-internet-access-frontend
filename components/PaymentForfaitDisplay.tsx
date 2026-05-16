'use client'

import type { Payment } from '@/types/api'
import { UserRole } from '@/types/api'
import { getPaymentForfaitLabel, getPaymentTicketUsername } from '@/lib/normalize-payment-list'

type PaymentForfaitDisplayProps = {
  payment: Payment
  viewerRole?: UserRole | string
  className?: string
  usernameClassName?: string
}

/** Forfait (profil) pour tous ; identifiant Wi‑Fi uniquement pour les admins. */
export default function PaymentForfaitDisplay({
  payment,
  viewerRole,
  className = '',
  usernameClassName = 'mt-0.5 font-mono text-xs text-ink-500',
}: PaymentForfaitDisplayProps) {
  const forfaitLabel = getPaymentForfaitLabel(payment)
  const login = getPaymentTicketUsername(payment)
  const isAdmin = viewerRole === UserRole.ADMIN

  if (!forfaitLabel && !login) {
    return <span className={className}>—</span>
  }

  const primary = forfaitLabel ?? (isAdmin ? login : null)
  if (!primary) {
    return <span className={className}>—</span>
  }

  return (
    <div className={className}>
      <span className="text-ink-800">{primary}</span>
      {isAdmin && login && forfaitLabel ? (
        <p className={usernameClassName}>{login}</p>
      ) : null}
    </div>
  )
}
