# Paiements KELPAY (Mobile Money) — guide frontend

Ce document décrit le flux **KELPAY** (initiation + suivi) par rapport à l’**achat cash** classique, les contrats JSON, le polling et la récupération des tickets après succès. Les chemins d’API sont relatifs à la base `NEXT_PUBLIC_API_URL` (ex. `http://localhost:4000/api`).

## KELPAY vs achat cash

| | **KELPAY (Mobile Money)** | **Achat cash / direct** |
|---|---------------------------|-------------------------|
| Endpoint | `POST /payments/initiate` | `POST /tickets/purchase` |
| Auth | **Bearer JWT obligatoire** | Selon configuration backend (souvent public ou JWT selon le déploiement) |
| Rôle | Crée un paiement Mobile Money ; le backend parle à KELPAY ; le client suit le statut. | Attribue / finalise le ticket selon la méthode (`cash`, `mobile_money`, etc.). |
| UI typique | Initiation → attente → polling `GET /payments/{paymentId}` → succès → `GET /tickets/me` | Réponse immédiate avec ticket / identifiants si le backend le renvoie. |

**Aucun secret KELPAY** (clé API, signature, webhook secret) ne doit figurer dans le frontend : tout reste côté serveur.

---

## `POST /payments/initiate` (KELPAY)

**Headers**

- `Authorization: Bearer <access_token>` — obligatoire.
- `Content-Type: application/json`

**Corps JSON (exemple)**

```json
{
  "ticketId": "<uuid>",
  "phoneNumber": "+243900000000",
  "amount": 5000,
  "userId": "<uuid>"
}
```

### Règles importantes

- **`ticketId`** : ticket disponible choisi par l’utilisateur.
- **`phoneNumber`** : numéro Mobile Money (format attendu par le backend, ex. `+243…`).
- **`amount`** : montant en **CDF**, en général **aligné sur le prix du ticket** affiché côté catalogue. Un écart peut être refusé par le backend.
- **`userId`** : identifiant de l’utilisateur connecté. Souvent **optionnel** si le backend déduit l’acheteur du JWT ; si fourni, il doit **correspondre** au sujet du token (pas d’achat pour un autre compte).
- Le **JWT** porte l’identité : ne pas exposer de clés KELPAY ; ne pas contourner l’auth.

### Réponse typique après initiation

```json
{
  "paymentId": "<uuid>",
  "merchantReference": "..."
}
```

Le backend peut ajouter d’autres champs (message, URL, etc.) — le frontend doit au minimum conserver **`paymentId`** pour le polling.

---

## Suivi du paiement : `GET /payments/{paymentId}`

Après `initiate`, l’interface doit **interroger régulièrement** l’état du paiement :

- **Intervalle conseillé** : environ **3 à 5 secondes** entre deux appels.
- **Headers** : `Authorization: Bearer <token>` (même utilisateur que l’initiation, sauf règle admin spécifique).

Arrêter le polling lorsque le statut est **terminal** (succès ou échec / expiration).

### Statuts courants (exemples)

Les libellés exacts peuvent varier légèrement selon le backend ; en pratique on retrouve souvent :

| Statut (exemple) | Signification |
|------------------|----------------|
| `pending` | Paiement créé, en attente d’action (ex. push USSD / confirmation opérateur). |
| `processing` | Traitement en cours côté opérateur / KELPAY. |
| `success` ou `completed` | **Paiement réussi** — le ticket peut être attribué ; passer à la récupération des tickets. |
| `failed` | Paiement refusé ou erreur métier. |
| `expired` | Délai dépassé sans confirmation. |
| `cancelled` | Annulé (utilisateur ou système). |

Le frontend peut traiter **`success`** et **`completed`** comme équivalents pour afficher le succès.

---

## Après succès : `GET /tickets/me`

Une fois le paiement en état de succès :

1. Appeler **`GET /tickets/me`** (JWT requis) pour lister les tickets de l’utilisateur.
2. Retrouver le ticket acheté (par `id`, `paymentId`, ou le plus récemment vendu selon les données renvoyées).
3. Afficher identifiants Wi‑Fi / profil comme pour un achat classique.

Si le ticket n’apparaît pas immédiatement (webhook légèrement en retard), **réessayer** `GET /tickets/me` quelques fois avec un court délai (1–2 s) avant d’afficher une erreur.

---

## Rappels sécurité & UX

- Pas de secrets KELPAY dans le repo frontend ni dans les variables `NEXT_PUBLIC_*`.
- Toujours passer le **Bearer token** sur `initiate` et sur le polling `/payments/:id`.
- Prévoir un **timeout** de polling (ex. plusieurs minutes) et un message clair si expiration.
- En cas d’échec, proposer de réessayer ou un autre moyen de paiement (ex. cash en point de vente si disponible).

---

## Références code dans ce dépôt

- Types : `types/frontend-types.ts` (`InitiateKelpayPaymentRequest`, `InitiateKelpayPaymentResponse`).
- Client : `lib/api-client.ts` — `apiClient.payments.initiateKelpay`, `apiClient.payments.getById`, `apiClient.tickets.mine`.
- Exemple minimal : `lib/frontend-api-client.ts`.
- Flux UI : `app/buy-ticket/page.tsx` (choix Kelpay / espèces).
