# Flux d’authentification (frontend)

Résumé des écrans et des endpoints utilisés. Pour les contraintes de sécurité (rôles, **429**, webhook, etc.), voir **[FRONTEND_SECURITY_SYNC.md](./FRONTEND_SECURITY_SYNC.md)**.

## Inscription (e-mail + code)

1. **`POST /api/auth/register/request`** — corps : e-mail, mot de passe, prénom, nom, téléphone optionnel.  
2. **`POST /api/auth/register/resend`** — renvoi du code sur le même e-mail.  
3. **`POST /api/auth/register/verify`** — e-mail + code à 6 chiffres → réponse type login avec **`access_token`**.

**Front** : `app/register/page.tsx` (`apiClient.auth.*`). Après succès de l’étape 3, le JWT est appliqué via `applyAuthResponse` du contexte d’auth.

## Connexion

**`POST /api/auth/login`** — e-mail + mot de passe → JWT.

**Front** : `components/Login.tsx` (`authService.login` / Axios). En cas de **429**, message dédié et cooldown (voir `lib/auth-flow-errors.ts`).

## Profil

**`GET /api/auth/profile`** — utilisateur connecté (Bearer).

**Front** : `AuthProvider` au chargement si un token est présent.

## Mot de passe oublié / réinitialisation

- **`POST /api/auth/forgot-password`** — e-mail.  
- **`POST /api/auth/reset-password`** — jeton (lien e-mail) + nouveau mot de passe.

**Front** : `components/ForgotPassword.tsx`, `components/ResetPassword.tsx` (`authService`). Sur **429** (forgot / reset), un message explicite est affiché pour éviter les rafales.
