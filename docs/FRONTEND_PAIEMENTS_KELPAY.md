# Paiements KELPAY (Mobile Money) — guide frontend

Ce document est aligné sur le contrat backend : **pas d’appel direct à Kelpay** depuis le navigateur ; **pas de boucle de polling** après `initiate` côté serveur. Le client enchaîne **`kelpay/verify`** puis **`kelpay/confirm`** (et peut utiliser **`GET /payments/:id`** pour rafraîchir l’état, p. ex. si un callback Kelpay a déjà finalisé le paiement).

Les chemins sont relatifs à `NEXT_PUBLIC_API_URL` (souvent suffixe `/api`).

## KELPAY (3 actions) vs espèces

| | **KELPAY** | **Espèces** |
|---|------------|-------------|
| Flux | `POST /payments/initiate` → `POST /payments/:id/kelpay/verify` → `POST /payments/:id/kelpay/confirm` ; annulation possible → **`POST /payments/:id/kelpay/cancel`** (ou secours `POST /tickets/:id/release`) | `POST /tickets/purchase` avec `method: "cash"` |
| Rôle | `initiate` réserve le ticket et crée le paiement ; **ne pas** appeler `purchase` avec `mobile_money` en parallèle si vous utilisez `initiate`. | Paiement `pending`, complétion admin possible. |
| UI | Trois moments distincts (boutons / écrans) ; l’utilisateur peut **prendre son temps** entre chaque étape tant que le paiement reste ouvert. | Confirmation unique. |

## Corps `POST /payments/initiate`

```json
{
  "ticketId": "<uuid>",
  "phoneNumber": "+243900000000",
  "amount": 1000,
  "userId": "<uuid>"
}
```

- **`amount`** : en pratique **strictement** le prix du type de ticket (`ticketType.price` côté backend). Le front de `app/buy-ticket/page.tsx` envoie le prix du **forfait** (`kelpayTypePriceCdf(ticketType)`).
- **`userId`** : obligatoire ; pour un étudiant, identique au sujet du JWT.

## Verify & Confirm

- **`POST /payments/:paymentId/kelpay/verify`** — un `checktransaction` côté serveur. Champs utiles : `readyToConfirm`, `paymentStatus` (ou `payment_status`). Interprétation côté front : **`paymentStatus`** → `success` | `failed` | **`unknown`** (y compris `unknown` / fautes `unknow` / `unkwon`, `pending`, `processing`, vide) : en **`unknown`**, ne pas conclure ; réessayer **verify** plus tard. Voir `classifyKelpayVerifyDecision` dans `types/frontend-types.ts`.
- **`POST /payments/:paymentId/kelpay/confirm`** — idempotent ; **`409`** si Kelpay n’a pas encore confirmé → relancer **verify** plus tard.
- **`POST /payments/:paymentId/kelpay/cancel`** — abandon utilisateur tant que le paiement est encore **`pending`** ou **`processing`** (vérifié par `GET /payments/:id` avant l’appel). Si cette route n’existe pas encore côté API, le front peut tenter en secours **`POST /tickets/:ticketId/release`** (voir `app/buy-ticket/page.tsx`).

## `GET /payments/:id`

Utile pour afficher l’état, détecter un **callback** déjà passé en `success`, ou bouton « Actualiser l’état » sans refaire un verify. Après **initiate**, le front peut mémoriser `paymentId` / `ticketId` dans **`sessionStorage`** pour reprendre l’écran après un F5 (même onglet, même `?type=`).

## Après succès

- **`GET /tickets/me`** pour récupérer le ticket et les identifiants Wi‑Fi.
- Le flux dans `app/buy-ticket/page.tsx` réutilise `fetchTicketAfterKelpay` (court retry) si la liste n’est pas encore à jour.

## Références code dans ce dépôt

- Types : `types/frontend-types.ts` — dont `isKelpayPaymentPendingOrProcessing` (annulation côté UI).
- Client : `lib/api-client.ts` — `initiateKelpay`, `verifyKelpay`, `confirmKelpay`, **`cancelKelpay`**, `getById`.
- Exemple minimal : `lib/frontend-api-client.ts`.
- Axios (legacy) : `services/api.ts` — mêmes méthodes.
- UI : `app/buy-ticket/page.tsx` ; liste **Mes paiements** : `components/Payments.tsx` (colonne Actions : **Compléter** / **Annuler** pour Mobile Money `pending` ou `processing`).

Aucun secret KELPAY dans le frontend ni dans `NEXT_PUBLIC_*`.
