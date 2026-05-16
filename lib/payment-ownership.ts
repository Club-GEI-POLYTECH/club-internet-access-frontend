import type { Payment } from '@/types/api'

/** Paiements appartenant à l’utilisateur connecté (si `createdBy` est renseigné côté API). */
export function filterPaymentsForUser(payments: Payment[], userId: string | undefined): Payment[] {
  if (!userId || payments.length === 0) return payments

  const withOwner = payments.filter((p) => p.createdById || p.createdBy?.id)
  if (withOwner.length === 0) {
    return payments
  }

  return payments.filter(
    (p) => p.createdById === userId || p.createdBy?.id === userId,
  )
}
