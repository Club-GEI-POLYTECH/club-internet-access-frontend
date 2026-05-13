/**
 * Client d’exemple — paiements KELPAY & tickets « mine ».
 * La source de vérité des appels est `lib/api-client.ts` (`apiClient`).
 *
 * Vous pouvez copier ce fichier dans un autre repo Next.js pour documenter
 * les deux points d’entrée sans dupliquer la logique `fetch` / tokens.
 *
 * @see docs/FRONTEND_PAIEMENTS_KELPAY.md
 */

import type { InitiateKelpayPaymentRequest, InitiateKelpayPaymentResponse } from '@/types/frontend-types'
import type { Ticket } from '@/types/api'
import { apiClient } from './api-client'

export const frontendApiClient = {
  payments: {
    initiateKelpay: (data: InitiateKelpayPaymentRequest): Promise<InitiateKelpayPaymentResponse> =>
      apiClient.payments.initiateKelpay(data),
  },
  tickets: {
    /** Tickets de l’utilisateur connecté — `GET /tickets/me` */
    mine: (): Promise<Ticket[]> => apiClient.tickets.mine(),
  },
}
