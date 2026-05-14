/**
 * Routes de l'API backend - Club Internet Access
 * Aligné collection Postman (chemins relatifs à la base API, ex. `http://localhost:4000/api`).
 * Les chemins sont relatifs à API_URL (ex: API_URL + '/auth/login').
 *
 * Usage: import { API_ENDPOINTS } from '@/lib/api-endpoints'
 * const path = API_ENDPOINTS.auth.login  // '/auth/login'
 */

const DEFAULT_API_URL = 'http://localhost:4000/api'

/**
 * Retourne l'URL de base de l'API à utiliser.
 * En local (localhost / 127.0.0.1), force toujours HTTP pour éviter
 * ERR_SSL_PROTOCOL_ERROR quand le backend ne sert que du HTTP.
 */
export function getApiUrl(): string {
  const raw = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : DEFAULT_API_URL
  try {
    const u = new URL(raw)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      u.protocol = 'http:'
      return u.toString()
    }
    return raw
  } catch {
    return raw
  }
}

export const API_ENDPOINTS = {
  // --- App ---
  app: {
    root: '',
    health: '/health',
  },

  // --- Auth (collection Postman : register/request, verify, resend) ---
  auth: {
    registerRequest: '/auth/register/request',
    registerVerify: '/auth/register/verify',
    registerResend: '/auth/register/resend',
    login: '/auth/login',
    profile: '/auth/profile',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },

  // --- Payments ---
  payments: {
    list: '/payments',
    /** KELPAY Mobile Money — JWT requis */
    initiateKelpay: '/payments/initiate',
    kelpayVerify: (id: string) => `/payments/${id}/kelpay/verify`,
    kelpayConfirm: (id: string) => `/payments/${id}/kelpay/confirm`,
    kelpayCancel: (id: string) => `/payments/${id}/kelpay/cancel`,
    get: (id: string) => `/payments/${id}`,
    getByTransaction: (transactionId: string) => `/payments/transaction/${transactionId}`,
    create: '/payments',
    complete: (id: string) => `/payments/${id}/complete`,
    updateStatus: (id: string) => `/payments/${id}/status`,
  },

  // --- Dashboard (statistiques vente / générales) ---
  dashboard: {
    myStats: '/dashboard/my-stats',
    stats: '/dashboard/stats',
    charts: (days: number) => `/dashboard/charts?days=${days}`,
  },

  // --- Tickets (public + achat) ---
  tickets: {
    list: '/tickets',
    listByStatus: (status: string) => `/tickets?status=${status}`,
    available: '/tickets/available',
    types: '/tickets/types',
    typeById: (typeId: string) => `/tickets/types/${typeId}`,
    byType: (typeId: string) => `/tickets/type/${typeId}`,
    get: (id: string) => `/tickets/${id}`,
    purchase: '/tickets/purchase',
    /** Tickets de l’utilisateur connecté (JWT) */
    mine: '/tickets/me',
    reserve: (id: string) => `/tickets/${id}/reserve`,
    release: (id: string) => `/tickets/${id}/release`,
    webhookPayment: '/tickets/webhook/payment',
  },

  // --- Admin Tickets (préfixe /admin/tickets) ---
  adminTickets: {
    import: '/admin/tickets/import',
    importRecommendations: '/admin/tickets/import/recommendations',
    stats: '/admin/tickets/stats',
    updatePrice: (ticketId: string) => `/admin/tickets/${ticketId}/price`,
    delete: (ticketId: string) => `/admin/tickets/${ticketId}`,
  },

  // --- Tickets Admin (préfixe /tickets/admin, alternatif backend) ---
  ticketsAdmin: {
    import: '/tickets/admin/import',
    importRecommendations: '/tickets/admin/import/recommendations',
    stats: '/tickets/admin/stats',
    updatePrice: (ticketId: string) => `/tickets/admin/${ticketId}/price`,
    delete: (ticketId: string) => `/tickets/admin/${ticketId}`,
  },
} as const
