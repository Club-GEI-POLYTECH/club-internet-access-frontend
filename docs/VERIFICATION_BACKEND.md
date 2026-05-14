# ✅ Vérifications Backend Requises

Ce document liste toutes les vérifications nécessaires au niveau du backend après l'implémentation des dashboards par rôle.

---

## 🔐 1. Authentification & Rôles

### ✅ Endpoints à vérifier

#### **GET `/api/auth/profile`**
- [ ] Retourne l'utilisateur connecté avec son `role` (`admin`, `agent`, `student`)
- [ ] Le champ `role` est bien inclus dans la réponse
- [ ] Le champ `isActive` est présent pour vérifier si l'utilisateur est actif

**Réponse attendue :**
```json
{
  "id": "string",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "role": "admin" | "agent" | "student",
  "isActive": true,
  "createdAt": "string",
  "updatedAt": "string"
}
```

#### **Inscription par e-mail (flux en 3 appels, préfixe `/api/auth`)**

- [ ] **POST `/api/auth/register/request`** — corps : `email`, `password`, `firstName`, `lastName`, `phone` (optionnel) ; envoie le code e-mail
- [ ] **POST `/api/auth/register/verify`** — corps : `email`, `code` ; retourne `access_token` (+ `user` si exposé), aligné login
- [ ] **POST `/api/auth/register/resend`** — corps : `email` ; renvoie le code
- [ ] Rôle `student` par défaut après vérification ; pas d’inscription publique `admin` / `agent`

---

## 📊 2. Dashboard Admin

### ✅ Endpoints requis

#### **GET `/api/dashboard/stats`**
- [ ] Accessible uniquement aux `admin`
- [ ] Retourne les statistiques complètes :
  ```json
  {
    "accounts": {
      "total": 0,
      "active": 0,
      "expired": 0
    },
    "payments": {
      "total": 0,
      "completed": 0,
      "pending": 0,
      "failed": 0,
      "revenue": 0
    },
    "sessions": {
      "total": 0,
      "active": 0,
      "mikrotikActive": 0,
      "totalBytesTransferred": 0
    },
    "users": {
      "total": 0,
      "active": 0
    }
  }
  ```

#### **GET `/api/dashboard/charts?days=7`**
- [ ] Accessible uniquement aux `admin`
- [ ] Retourne les données de graphiques pour les 7 derniers jours :
  ```json
  {
    "accounts": [
      {
        "date": "2024-01-19",
        "created": 10,
        "expired": 5
      }
    ],
    "payments": [
      {
        "date": "2024-01-19",
        "count": 15,
        "revenue": 50000
      }
    ],
    "sessions": [
      {
        "date": "2024-01-19",
        "active": 20,
        "new": 10
      }
    ]
  }
  ```

---

## 💰 3. Dashboard Agent

### ✅ Endpoints requis

#### **GET `/api/wifi-accounts`**
- [ ] Accessible aux `admin` et `agent`
- [ ] Retourne la liste des comptes Wi-Fi
- [ ] Optionnel : Filtrer par agent si nécessaire

#### **POST `/api/wifi-accounts`**
- [ ] Accessible aux `admin` et `agent`
- [ ] Permet de créer un compte Wi-Fi avec :
  ```json
  {
    "duration": "24h" | "48h" | "7d" | "30d" | "unlimited",
    "bandwidthProfile": "1mbps" | "2mbps" | "5mbps",
    "maxDevices": 1,
    "comment": "string"
  }
  ```
- [ ] Génère automatiquement `username` et `password`
- [ ] Retourne le compte créé avec `username` et `password` pour affichage

#### **GET `/api/payments`**
- [ ] Accessible aux `admin` et `agent`
- [ ] Retourne la liste des paiements
- [ ] Inclut les informations du compte Wi-Fi associé si présent

#### **POST `/api/payments`**
- [ ] Accessible aux `admin` et `agent`
- [ ] Permet de créer un paiement manuel :
  ```json
  {
    "amount": 1000,
    "method": "mobile_money" | "card",
    "phoneNumber": "+243900000000",
    "wifiAccountId": "string (optionnel)",
    "notes": "string (optionnel)"
  }
  ```
- [ ] Peut créer automatiquement un compte Wi-Fi après paiement si `wifiAccountId` n'est pas fourni

---

## 👨‍🎓 4. Dashboard Student

### ✅ Endpoints requis

#### **GET `/api/wifi-accounts`**
- [ ] Accessible aux `student` **MAIS filtré**
- [ ] Retourne uniquement les comptes Wi-Fi de l'étudiant connecté
- [ ] **À vérifier :** Le backend doit filtrer par `createdById` ou avoir une relation `user` sur les comptes Wi-Fi

**Option 1 :** Filtrer par `createdById`
```typescript
// Backend doit vérifier user.id === account.createdById
```

**Option 2 :** Relation directe dans les comptes Wi-Fi
```json
{
  "id": "string",
  "userId": "string", // ID de l'étudiant propriétaire
  "username": "string",
  "password": "string",
  // ...
}
```

#### **GET `/api/payments`**
- [ ] Accessible aux `student` **MAIS filtré**
- [ ] Retourne uniquement les paiements de l'étudiant connecté
- [ ] **À vérifier :** Filtrer par `createdById` ou `userId`

#### **POST `/api/payments`**
- [ ] Accessible aux `student`
- [ ] Permet de créer un paiement pour acheter une connexion
- [ ] **Important :** Après paiement complété, créer automatiquement un compte Wi-Fi pour l'étudiant
- [ ] Le paiement doit être lié à l'étudiant connecté via `createdById`

**Logique attendue :**
1. Étudiant crée un paiement via le dashboard
2. Paiement est marqué comme `pending`
3. Après validation (webhook ou manuel), le paiement passe à `completed`
4. Un compte Wi-Fi est automatiquement créé pour l'étudiant
5. Le compte Wi-Fi est lié au paiement via `wifiAccountId`

---

## 🔒 5. Contrôles d'Accès (Middleware/Guards)

### ✅ Vérifications importantes

#### **Protection par rôle**
- [ ] Tous les endpoints de dashboard sont protégés par authentification
- [ ] Les endpoints admin ne sont accessibles qu'aux `admin`
- [ ] Les endpoints agent sont accessibles aux `admin` et `agent`
- [ ] Les endpoints student sont accessibles aux `admin` et `student` (mais filtrés)

#### **Filtrage des données**
- [ ] Les étudiants voient uniquement **leurs propres** comptes Wi-Fi
- [ ] Les étudiants voient uniquement **leurs propres** paiements
- [ ] Les agents voient **tous** les comptes et paiements (sauf restriction spécifique)
- [ ] Les admins voient **tout**

---

## 🔗 6. Relations de Données

### ✅ Relations à vérifier

#### **WiFiAccount ↔ User**
- [ ] Un compte Wi-Fi peut avoir un propriétaire (`createdById` ou `userId`)
- [ ] Pour les étudiants, cette relation est obligatoire
- [ ] Pour les comptes créés par agents, le `createdById` doit pointer vers l'agent

#### **Payment ↔ User**
- [ ] Un paiement est lié à un utilisateur via `createdById` ou `userId`
- [ ] Pour identifier qui a payé (étudiant, agent, etc.)

#### **Payment ↔ WiFiAccount**
- [ ] Un paiement peut être lié à un compte Wi-Fi via `wifiAccountId`
- [ ] Après création automatique d'un compte via paiement, le lien doit être créé

---

## 📱 7. Workflow Paiement Étudiant

### ✅ Processus à vérifier

1. **Étudiant crée un paiement** (`POST /api/payments`)
   - [ ] Le paiement est créé avec `status: "pending"`
   - [ ] `createdById` = ID de l'étudiant connecté

2. **Paiement complété** (webhook ou manuel)
   - [ ] `POST /api/payments/:id/complete`
   - [ ] Change `status` à `"completed"`
   - [ ] **Important :** Crée automatiquement un compte Wi-Fi
   - [ ] Le compte Wi-Fi est lié au paiement via `wifiAccountId`
   - [ ] Le compte Wi-Fi est lié à l'étudiant via `createdById`

3. **Étudiant voit son compte**
   - [ ] `GET /api/wifi-accounts` retourne le nouveau compte
   - [ ] Filtré par l'ID de l'étudiant

---

## 🧪 8. Tests à Effectuer

### ✅ Scénarios de test

#### **Test Admin**
- [ ] Connexion en tant qu'admin
- [ ] Accès au dashboard admin avec toutes les statistiques
- [ ] Voir tous les comptes Wi-Fi
- [ ] Voir tous les paiements
- [ ] Gérer les utilisateurs

#### **Test Agent**
- [ ] Connexion en tant qu'agent
- [ ] Accès au dashboard agent
- [ ] Créer un paiement manuel
- [ ] Créer un compte Wi-Fi (jeton)
- [ ] Voir les comptes Wi-Fi créés
- [ ] ❌ Ne peut pas accéder aux endpoints admin

#### **Test Student**
- [ ] Connexion en tant qu'étudiant
- [ ] Accès au dashboard étudiant
- [ ] Créer un paiement pour acheter une connexion
- [ ] Voir uniquement ses propres comptes Wi-Fi
- [ ] Voir uniquement ses propres paiements
- [ ] ❌ Ne peut pas accéder aux endpoints admin/agent
- [ ] ❌ Ne peut pas voir les comptes des autres étudiants

---

## 📋 9. Checklist Backend

### ✅ Résumé des vérifications

- [ ] **Authentification** : `/api/auth/profile` retourne le rôle
- [ ] **Dashboard Admin** : `/api/dashboard/stats` et `/api/dashboard/charts` accessibles
- [ ] **Dashboard Agent** : Peut créer paiements et comptes Wi-Fi
- [ ] **Dashboard Student** : Peut créer paiements, voir uniquement ses comptes
- [ ] **Filtrage** : Les étudiants voient uniquement leurs données
- [ ] **Workflow** : Paiement étudiant → Compte Wi-Fi créé automatiquement
- [ ] **Relations** : WiFiAccount et Payment liés aux utilisateurs
- [ ] **Contrôles d'accès** : Middleware/guards par rôle fonctionnent
- [ ] **Tests** : Tous les scénarios fonctionnent

---

## 🚨 10. Points Critiques

### ⚠️ À vérifier absolument

1. **Filtrage Student** : Les étudiants ne doivent **JAMAIS** voir les comptes Wi-Fi des autres
2. **Création automatique** : Après paiement étudiant complété, le compte Wi-Fi doit être créé **automatiquement**
3. **Permissions** : Les agents et étudiants ne peuvent pas accéder aux endpoints admin
4. **Relations** : Tous les comptes Wi-Fi et paiements doivent avoir un `createdById` ou `userId`

---

**Dernière mise à jour :** 2024-01-19
