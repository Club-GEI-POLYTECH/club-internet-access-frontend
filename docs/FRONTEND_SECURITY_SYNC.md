# Synchronisation sécurité — frontend ↔ API Club Internet Access

Ce document aligne le frontend sur le contrat décrit dans la **collection Postman** du backend et sur les bonnes pratiques de sécurité.

## 1. `GET/POST/PUT/DELETE /api/users` — **admin uniquement**

- Le backend réserve la gestion des utilisateurs au rôle **admin**.
- Le frontend : entrée **Utilisateurs** uniquement pour les admins ([`components/Layout.tsx`](../components/Layout.tsx)), page [`app/admin/users/page.tsx`](../app/admin/users/page.tsx) redirige les non-admins vers `/dashboard`.
- En cas de **403**, afficher un message clair (pas seulement « erreur réseau ») — géré via [`lib/api-client.ts`](../lib/api-client.ts) et les `notify` dans les écrans concernés.
- Ne **jamais** supposer la présence d’un champ `password` dans les JSON utilisateur renvoyés en lecture : le type [`User`](../types/api.ts) n’expose pas le mot de passe ; tout champ parasite est retiré côté client ([`lib/sanitize-user.ts`](../lib/sanitize-user.ts)).

## 2. `POST /api/tickets/webhook/payment`

- En-tête **`X-Payment-Webhook-Secret`** aligné sur **`TICKETS_PAYMENT_WEBHOOK_SECRET`** côté serveur.
- **À n’appeler que depuis le backend** (Kelpay, worker, etc.) — **pas** depuis le navigateur et **aucune** variable `NEXT_PUBLIC_*` pour ce secret dans le bundle.
- Réponses possibles : **401** (secret absent ou invalide), **503** (service indisponible). Le client HTTP gère un message utilisateur pour **503** ; le webhook n’est pas une route du frontend.

## 3. Throttling auth — **429 Too Many Requests**

- Le backend peut renvoyer **429** sur `login`, `register/*`, `forgot-password`, `reset-password`.
- Le frontend doit **ne pas** interpréter cela comme un simple « mauvais mot de passe » : message invitant à **patienter** et à réessayer plus tard (voir [`lib/api-client.ts`](../lib/api-client.ts) et intercepteur Axios dans [`services/api.ts`](../services/api.ts)).

## 4. Swagger / doc interactive

- En **production**, la doc OpenAPI interactive est en général **désactivée** : ne pas compter sur `GET /api` ou équivalent pour de la documentation en prod.

## 5. CORS et KELPAY

- Les appels passent par **`NEXT_PUBLIC_API_URL`** (même origine avec rewrite `/api` ou URL backend explicite).
- Le flux **KELPAY** côté navigateur reste : **`POST /api/payments/initiate`** → **`kelpay/verify`** → **`kelpay/confirm`** (et **`cancel`** si besoin) — **pas** d’appel direct navigateur vers `pay.keccel.com` pour le flux métier (la collection Postman peut inclure « Keccel direct » à des fins de test manuel uniquement).

## 6. Achat ticket hors KELPAY

- `POST /api/tickets/purchase` : `method` **`mobile_money`** ou **`card`** — **plus d’espèces** (`cash` retiré côté types et UI).

## 7. Tableau des codes HTTP utiles (client)

| Code | Comportement frontend (résumé) |
|------|--------------------------------|
| 401 | Déconnexion, redirection `/login` |
| 403 | Message « permissions insuffisantes » |
| 404 | Ressource introuvable |
| 429 | Throttling — patienter, ne pas boucler agressivement |
| 503 | Service indisponible — réessayer plus tard |
| 5xx | Message générique + logs |

## Fichiers à tenir à jour avec l’API

- [`types/api.ts`](../types/api.ts), [`types/frontend-types.ts`](../types/frontend-types.ts)
- [`lib/api-endpoints.ts`](../lib/api-endpoints.ts), [`lib/api-client.ts`](../lib/api-client.ts)
- [`services/api.ts`](../services/api.ts) (Axios / auth)
