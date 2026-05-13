/**
 * Types complémentaires pour l’intégration paiements KELPAY (Mobile Money).
 * Les types métier généraux restent dans `types/api.ts`.
 *
 * Vous pouvez copier ce fichier tel quel dans un autre monorepo / app Next.js.
 */

/** Corps attendu pour `POST /payments/initiate`. */
export interface InitiateKelpayPaymentRequest {
  ticketId: string
  phoneNumber: string
  /** Montant en CDF — en pratique aligné sur le prix du ticket affiché. */
  amount: number
  /**
   * Optionnel si le backend déduit l’utilisateur du JWT.
   * Si fourni, doit correspondre au sujet du token.
   */
  userId?: string
}

/** Réponse minimale après initiation KELPAY (champs additionnels possibles). */
export interface InitiateKelpayPaymentResponse {
  paymentId: string
  merchantReference?: string
}

/** Statuts de workflow côté API (chaînes ; le backend peut étendre la liste). */
export type KelpayPaymentWorkflowStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | (string & {})

export function isKelpayPaymentSuccessStatus(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'success' || s === 'completed'
}

export function isKelpayPaymentFailureStatus(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'failed' || s === 'cancelled' || s === 'expired'
}
