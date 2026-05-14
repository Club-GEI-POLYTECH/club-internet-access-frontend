/**
 * Client d’exemple — paiements KELPAY & tickets « mine ».
 * La source de vérité des appels est `lib/api-client.ts` (`apiClient`).
 *
 * **Hors périmètre ici (sécurité)** :
 * - **`/api/users/*`** : réservé **admin** — utiliser `apiClient.users` uniquement derrière une UI / route réservée aux admins.
 * - **`POST /api/tickets/webhook/payment`** : réservé à un **serveur** (secret `TICKETS_PAYMENT_WEBHOOK_SECRET`), jamais depuis le navigateur.
 *
 * Vous pouvez copier ce fichier dans un autre repo Next.js pour documenter
 * les deux points d’entrée sans dupliquer la logique `fetch` / tokens.
 *
 * @see docs/FRONTEND_PAIEMENTS_KELPAY.md — initiate, verifyKelpay, confirmKelpay, cancelKelpay.
 * @see docs/FRONTEND_SECURITY_SYNC.md — rôles, 429, webhook, Swagger prod.
 */

import type {
  InitiateKelpayPaymentRequest,
  InitiateKelpayPaymentResponse,
  KelpayConfirmPaymentResponse,
  KelpayVerifyPaymentResponse,
  ImportTicketsMultipartOptions,
} from '@/types/frontend-types'
import type { Ticket, Payment } from '@/types/api'
import { apiClient } from './api-client'

export const frontendApiClient = {
  payments: {
    initiateKelpay: (data: InitiateKelpayPaymentRequest): Promise<InitiateKelpayPaymentResponse> =>
      apiClient.payments.initiateKelpay(data),
    verifyKelpay: (paymentId: string): Promise<KelpayVerifyPaymentResponse> =>
      apiClient.payments.verifyKelpay(paymentId),
    confirmKelpay: (paymentId: string): Promise<KelpayConfirmPaymentResponse> =>
      apiClient.payments.confirmKelpay(paymentId),
    cancelKelpay: (paymentId: string): Promise<Payment> => apiClient.payments.cancelKelpay(paymentId),
  },
  tickets: {
    /** Tickets de l’utilisateur connecté — `GET /tickets/me` */
    mine: (): Promise<Ticket[]> => apiClient.tickets.mine(),
    /**
     * Import CSV admin — `POST /admin/tickets/import` (repli 404 : `POST /tickets/admin/import`).
     * Multipart : `file`, `ticketTypeId` (UUID depuis `GET /tickets/types`) ou `catalogDuration` seul.
     */
    adminImportCsv: (
      file: File,
      options?: ImportTicketsMultipartOptions,
    ): Promise<{ imported: number; failed: number; errors: string[] }> =>
      apiClient.admin.tickets.import(file, options),
  },
}
