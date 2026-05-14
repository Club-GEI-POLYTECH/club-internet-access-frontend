/**
 * Types complémentaires pour l’intégration paiements KELPAY (Mobile Money).
 * Les types métier généraux restent dans `types/api.ts`.
 *
 * Flux backend : `POST /payments/initiate` → `POST /payments/:id/kelpay/verify`
 * → `POST /payments/:id/kelpay/confirm` (pas de polling automatique côté serveur).
 *
 * **Sécurité / contrat API** (voir `docs/FRONTEND_SECURITY_SYNC.md`) :
 * - `GET/POST/PUT/DELETE /api/users/*` : **admin uniquement** ; pas de champ `password` dans les JSON utilisateur en lecture.
 * - `POST /api/tickets/webhook/payment` : en-tête `X-Payment-Webhook-Secret`, **appel serveur uniquement** (pas dans le bundle navigateur).
 * - Auth : gérer **429** sur login / register / forgot / reset (voir `lib/auth-flow-errors.ts`, `lib/api-client.ts`).
 * - **Swagger** : non disponible sur `/api` en production — ne pas s’en servir pour la découverte des routes.
 * - **Callback Kelpay** `POST /api/payments/callback` : filtre IP optionnel côté backend (`KELPAY_CALLBACK_ALLOWED_IPS`) ; le flux navigateur reste initiate → verify → confirm.
 */

import type { Payment } from '@/types/api'

/** Repli catalogue Nest quand `ticketTypeId` est absent (ancien comportement). */
export type CatalogDurationFallback = '24h' | '7j' | '30j'

/**
 * Champs multipart (hors `file`) pour `POST /admin/tickets/import` ou `POST /tickets/admin/import`.
 * Aligné sur le DTO Nest + Multer : envoyer `ticketTypeId` **ou** `catalogDuration`, pas les deux.
 */
export interface ImportTicketsMultipartOptions {
  /** UUID du type — `GET /tickets/types` ; prioritaire si défini (`catalogDuration` ignoré). */
  ticketTypeId?: string
  /** Uniquement si `ticketTypeId` est omis. */
  catalogDuration?: CatalogDurationFallback
}

/** Corps attendu pour `POST /payments/initiate`. */
export interface InitiateKelpayPaymentRequest {
  ticketId: string
  phoneNumber: string
  /** Montant en CDF — doit correspondre au prix du type de ticket (`ticketType.price`) côté backend. */
  amount: number
  /** Obligatoire : pour un étudiant, doit être identique au sujet du JWT. */
  userId: string
}

/** Réponse après initiation KELPAY (champs additionnels possibles). */
export interface InitiateKelpayPaymentResponse {
  paymentId: string
  merchantReference?: string
  transactionId?: string
  status?: string
  kelpay?: {
    raw?: string
    fields?: Record<string, string>
    transactionId?: string
    reference?: string
    kelpayCode?: string
    message?: string
  }
}

/** Réponse utile de `POST /payments/:paymentId/kelpay/verify`. */
export interface KelpayVerifyPaymentResponse {
  readyToConfirm?: boolean
  /** Variante snake_case possible selon sérialisation backend. */
  ready_to_confirm?: boolean
  kelpayTransactionStatus?: string
  paymentStatus?: string
  payment_status?: string
}

/**
 * Décision métier à partir de `paymentStatus` (verify ou, en secours, `GET /payments/:id`).
 * - `unknown` : pas encore tranché — ne pas conclure échec/succès ni activer Confirmer sur de simples heuristiques.
 */
export type KelpayVerifyDecision = 'success' | 'failed' | 'unknown'

function trimKelpayStatus(raw: string | undefined | null): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).trim()
}

export function classifyKelpayVerifyDecision(raw: string | undefined | null): KelpayVerifyDecision {
  const s = trimKelpayStatus(raw).toLowerCase()
  if (!s) return 'unknown'
  if (s === 'success' || s === 'completed') return 'success'
  if (s === 'failed' || s === 'cancelled' || s === 'expired') return 'failed'
  if (s === 'unknown' || s === 'unknow' || s === 'unkwon') return 'unknown'
  if (s === 'pending' || s === 'processing') return 'unknown'
  return 'unknown'
}

/** Lit `paymentStatus` / `payment_status` sur la réponse verify. */
export function kelpayVerifyPaymentStatusRaw(res: KelpayVerifyPaymentResponse): string {
  return trimKelpayStatus(res.paymentStatus ?? res.payment_status)
}

/** Réponse de `POST /payments/:paymentId/kelpay/confirm` (idempotent). */
export interface KelpayConfirmPaymentResponse {
  alreadyFinalized?: boolean
  payment?: Payment
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

export function kelpayVerifyReadyToConfirm(body: KelpayVerifyPaymentResponse): boolean {
  return Boolean(body.readyToConfirm ?? body.ready_to_confirm)
}

/** Paiement encore ouvert côté flux KELPAY (annulation utilisateur possible selon le backend). */
export function isKelpayPaymentPendingOrProcessing(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'pending' || s === 'processing'
}
