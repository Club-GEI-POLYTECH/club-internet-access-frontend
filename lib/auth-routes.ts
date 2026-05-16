import { UserRole } from '@/types/api'

/** Destination après connexion ou inscription réussie (tous les rôles). */
export const AUTH_DASHBOARD_PATH = '/dashboard'

/** Parcours d’achat Mobile Money réservé aux comptes étudiants. */
export function canPurchaseTickets(role: UserRole | string | undefined): boolean {
  return role === UserRole.STUDENT
}

export function postAuthRedirectPath(): string {
  return AUTH_DASHBOARD_PATH
}
