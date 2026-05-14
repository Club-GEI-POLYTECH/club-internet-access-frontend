# Club Internet Access — Frontend

Interface web Next.js pour la **vente de tickets Wi‑Fi** (catalogue, achat KELPAY ou espèces, mes tickets, administration des imports CSV).

## 🚀 Déploiement sur Vercel

### Configuration Automatique

Ce projet est configuré pour Vercel avec:
- ✅ Next.js 14 avec App Router
- ✅ Configuration TypeScript
- ✅ TailwindCSS intégré
- ✅ Variables d'environnement configurées

### Étapes de Déploiement

1. **Créer un projet sur Vercel**
   - Allez sur https://vercel.com
   - Connectez votre compte GitHub
   - Importez ce repository

2. **Configurer les Variables d'Environnement**
   - Dans Vercel Dashboard → Settings → Environment Variables (environnement **Production**)
   - Modèle prêt à copier : [`.env.production.example`](./.env.production.example)
   - **Option directe (recommandée si le backend autorise CORS)** :  
     `NEXT_PUBLIC_API_URL=https://VOTRE-BACKEND-PROD.example.com/api`  
     (remplacez par l’URL HTTPS réelle de l’API, avec `/api` si votre backend est préfixé ainsi.)
   - **Option proxy** (front et API même origine) :  
     `NEXT_PUBLIC_API_URL=/api` et `API_URL=https://VOTRE-BACKEND-PROD.example.com/api`  
     (`API_URL` sert au rewrite serveur dans `next.config.js`, voir aussi [`.env.example`](./.env.example).)

3. **Déployer**
   - Vercel détectera automatiquement Next.js
   - Le build se fera automatiquement
   - L'application sera accessible sur l'URL générée par Vercel

**C'est tout !** Vercel gère automatiquement les builds et déploiements.

## 📦 Développement Local

### Prérequis

- Node.js >= 18
- npm ou yarn

### Installation

```bash
npm install
```

### Développement

```bash
npm run dev
```

L'application sera accessible sur http://localhost:3000

### Build

```bash
npm run build
```

Les fichiers buildés seront dans le dossier `.next/`

### Production Locale

```bash
npm run start
```

## 🔧 Configuration

### Variables d'Environnement

- **Local** : copiez [`.env.example`](./.env.example) vers `.env.local` et adaptez.
- **Production (hébergeur)** : voir [`.env.production.example`](./.env.production.example) — c’est là que vous renseignez le **lien du backend de prod** (`NEXT_PUBLIC_API_URL`, et `API_URL` si vous utilisez le proxy `/api`).

Résumé :

| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_API_URL` | Base API côté navigateur (`https://…/api` ou `/api` en proxy) |
| `API_URL` | Cible du rewrite `/api/*` (serveur uniquement), requise en prod si `NEXT_PUBLIC_API_URL=/api` |

### Fichiers Importants

- `next.config.js`: Configuration Next.js avec rewrites pour l'API
- `app/layout.tsx`: Layout principal de l'application
- `services/api.ts`: Service API avec configuration de base URL
- `components/`: Composants réutilisables
- `contexts/`: Contextes React (Auth, etc.)

## 🏗️ Architecture (aperçu)

```
app/
├── layout.tsx
├── page.tsx                 # Redirection / accueil
├── login/                   # Connexion
├── register/
├── buy-ticket/              # Catalogue + achat (KELPAY / espèces)
├── my-tickets/              # Tickets de l’utilisateur connecté
├── dashboard/               # Tableaux de bord par rôle
├── admin/tickets/           # Admin / agent — import & gestion
├── payments/
└── users/

components/
├── Layout.tsx
└── …

lib/
├── api-client.ts            # Client fetch recommandé
├── frontend-api-client.ts   # Exemple KELPAY (délègue à api-client)
└── api.ts

types/
├── api.ts
└── frontend-types.ts        # Types initiation KELPAY
```

## 🔗 Backend

Le backend est dans un repository séparé: `club-internet-access-backend`

## 📚 Technologies

- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- Axios (compatible)
- Fetch API (Client API réutilisable)
- Recharts (Graphiques)
- React Hot Toast (Notifications)
- Lucide React (Icônes)

## 🔌 Client API

Le projet offre **deux options** pour les appels API :

1. **Client API réutilisable** (`lib/api-client.ts`) — **recommandé**
   ```typescript
   import { apiClient } from '@/lib/api-client'
   const types = await apiClient.tickets.getTypes()
   ```

2. **Services Axios** (`services/api.ts`) — compatible existant
   ```typescript
   import { paymentsService } from '@/services/api'
   const list = await paymentsService.getAll()
   ```

## Endpoints utiles (API)

Référence rapide alignée sur la collection Postman (`/api/...`) :

| Usage | Méthode & chemin |
|--------|------------------|
| Initier un paiement Mobile Money (KELPAY) | `POST /payments/initiate` (Bearer JWT) |
| Suivre un paiement | `GET /payments/{paymentId}` (polling ~3–5 s) |
| Achat direct (ex. espèces) | `POST /tickets/purchase` |
| Mes tickets (après paiement) | `GET /tickets/me` (Bearer JWT) |

**Guide détaillé** : [docs/FRONTEND_PAIEMENTS_KELPAY.md](./docs/FRONTEND_PAIEMENTS_KELPAY.md) (flux KELPAY vs cash, corps JSON, statuts, sécurité).

## 📚 Documentation

### Déploiement réseau

Pour le déploiement sur site avec Starlink + MikroTik + AP Cisco :

- **[Déploiement Complet](./docs/DEPLOIEMENT_COMPLET.md)** : Procédure complète de A à Z
- **[Checklist Installation](./docs/CHECKLIST_INSTALLATION.md)** : Checklist jour J
- **[Schéma Réseau](./docs/SCHEMA_RESEAU.md)** : Architecture technique détaillée
- **[Plan d'Évolution](./docs/PLAN_EVOLUTION.md)** : Migration RB951 → RB4011
- **[Scripts MikroTik](./docs/scripts/)** : Configurations prêtes à importer

### Intégration Backend

Pour intégrer avec le backend API :

- **[Paiements KELPAY (frontend)](./docs/FRONTEND_PAIEMENTS_KELPAY.md)** : initiation, polling, statuts, `GET /tickets/me`
- **[Intégration Backend](./docs/INTEGRATION_BACKEND.md)** : guide complet d'intégration
- **[Vérification Backend](./docs/VERIFICATION_BACKEND.md)** : ⚠️ **IMPORTANT** - Checklist des vérifications backend après implémentation des dashboards par rôle
- **Types TypeScript** : `types/api.ts`, `types/frontend-types.ts`
- **Service API** : `services/api.ts` et `lib/api.ts`
- **Hooks personnalisés** : `hooks/useApi.ts`

## 📝 License

Propriétaire - UNIKIN
