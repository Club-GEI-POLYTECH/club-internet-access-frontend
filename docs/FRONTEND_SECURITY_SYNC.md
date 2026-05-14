# Frontend — alignement sur les changements de sécurité (API)

Ce document liste ce que l’application **frontend** doit respecter après durcissement du backend (rôles, webhooks, rate limiting, Swagger, etc.).  
Préfixe API : **`/api`**. Types de référence : **`types/api.ts`**, **`types/frontend-types.ts`** ; client principal : **`lib/api-client.ts`** ; client d’exemple : **`lib/frontend-api-client.ts`**.

---

## 1. Gestion des utilisateurs (`/api/users/*`)

**Changement** : toutes les routes **`GET/POST/PUT/DELETE /api/users`** sont réservées au rôle **`admin`** (JWT avec `role: "admin"`). Un étudiant ou un agent ne doit plus appeler ces endpoints.

**Côté front (état du dépôt)**

- Navigation **Utilisateurs** : uniquement pour les admins (`components/Layout.tsx`).
- Page **`/admin/users`** : `PrivateRoute` avec `allowedRoles={[UserRole.ADMIN]}` + message dans `UserManagement` si accès direct.
- Les réponses utilisateur en lecture sont nettoyées de tout champ **`password`** parasite via **`lib/sanitize-user.ts`** ; le type **`User`** dans `types/api.ts` ne prévoit pas de mot de passe en lecture.

**Erreurs HTTP** : **`403 Forbidden`** — géré dans `lib/api-client.ts` (« Accès refusé… »).

---

## 2. Webhook interne ticket / paiement (`POST /api/tickets/webhook/payment`)

**Changement** : l’endpoint exige l’en-tête **`X-Payment-Webhook-Secret`** (aligné sur **`TICKETS_PAYMENT_WEBHOOK_SECRET`** côté backend).

**Côté front**

- **SPA navigateur** : ne pas appeler ce POST ni exposer le secret dans le bundle (`NEXT_PUBLIC_*`).
- **Serveur** (Route Handler Next, worker, etc.) : envoyer l’en-tête depuis une variable d’environnement **serveur uniquement**.

**Erreurs HTTP** : **`503`** si le secret n’est pas configuré sur le backend ; **`401`** si l’en-tête est absent ou incorrect. Le chemin est documenté dans `lib/api-endpoints.ts` à titre de référence — **pas** d’implémentation côté bundle client.

---

## 3. Limitation de débit (throttling) sur l’auth

**Changement** : limites par IP sur notamment :

- `POST /api/auth/register/request`, `register/verify`, `register/resend`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`, `reset-password`

**Côté front**

- **`429 Too Many Requests`** : messages dédiés dans **`lib/api-client.ts`** et l’intercepteur Axios **`services/api.ts`**.
- **UI** : **`lib/auth-flow-errors.ts`** — détection commune ; **Login** : toast « Limite de requêtes » + cooldown bouton 60 s après 429 ; **Inscription** (`app/register/page.tsx`) : toast explicite ; **Mot de passe oublié** : en cas de 429, erreur visible (sans masquer derrière le message ambigu « si l’adresse existe ») ; **Réinitialisation** : idem.
- Éviter les retries agressifs ; l’inscription a déjà un cooldown sur le renvoi de code.

---

## 4. Swagger / OpenAPI en production

**Changement** : avec **`NODE_ENV=production`**, la doc Swagger interactive n’est en général **plus** servie sur `/api`.

**Côté front** : ne pas dépendre de **`GET …/api`** pour la découverte des routes en prod — utiliser la doc du dépôt ou une export OpenAPI en dev.

---

## 5. CORS et en-têtes

L’en-tête **`X-Payment-Webhook-Secret`** peut être autorisé par CORS pour des cas très spécifiques ; en pratique, préférer un appel **same-origin** via un BFF. Les appels classiques **`Authorization`** + **`Content-Type`** restent inchangés côté front.

---

## 6. Callback Kelpay (`POST /api/payments/callback`)

Si **`KELPAY_CALLBACK_ALLOWED_IPS`** est défini sur le backend, seules ces IPs peuvent déclencher le traitement utile (les autres peuvent tout de même recevoir une réponse « OK » pour Keccel).

**Côté front** : aucun changement pour le flux **initiate → verify → confirm** depuis le navigateur. Tests locaux avec tunnel : coordonner avec le backend (variable vide = pas de filtre).

---

## 7. Récap des erreurs à gérer dans l’UI

| Code | Contexte typique | Action UI |
|------|------------------|-----------|
| **403** | Accès `/users` sans rôle admin | Redirection / message « réservé aux administrateurs » |
| **401** | Webhook ticket sans bon secret | Corriger l’intégration **serveur** uniquement |
| **503** | Webhook ou service indisponible | Message + réessayer plus tard |
| **429** | Trop de requêtes auth | Message + cooldown — **pas** « mot de passe incorrect » |

---

## 8. Fichiers à tenir à jour avec l’API

- **`types/api.ts`**, **`types/frontend-types.ts`**
- **`lib/api-endpoints.ts`**, **`lib/api-client.ts`**
- **`lib/auth-flow-errors.ts`** (messages 429 auth)
- **`services/api.ts`** (Axios)
- **`lib/frontend-api-client.ts`** (exemple / façade KELPAY, sans users ni webhook)

Flux inscription / mot de passe oublié (fonctionnel) : **[FRONTEND_AUTH_FLUX.md](./FRONTEND_AUTH_FLUX.md)**.
