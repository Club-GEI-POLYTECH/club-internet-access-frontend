/**
 * Routes de l'API backend - Club Internet Access
 * Aligné sur la collection Postman (baseUrl: http://localhost:4000/api)
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

  // --- Auth ---
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    profile: '/auth/profile',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },

  // --- Users ---
  users: {
    list: '/users',
    get: (id: string) => `/users/${id}`,
    create: '/users',
    update: (id: string) => `/users/${id}`,
    delete: (id: string) => `/users/${id}`,
  },

  // --- WiFi Accounts ---
  wifiAccounts: {
    list: '/wifi-accounts',
    active: '/wifi-accounts/active',
    get: (id: string) => `/wifi-accounts/${id}`,
    create: '/wifi-accounts',
    delete: (id: string) => `/wifi-accounts/${id}`,
  },

  // --- Payments ---
  payments: {
    list: '/payments',
    get: (id: string) => `/payments/${id}`,
    getByTransaction: (transactionId: string) => `/payments/transaction/${transactionId}`,
    create: '/payments',
    complete: (id: string) => `/payments/${id}/complete`,
    updateStatus: (id: string) => `/payments/${id}/status`,
  },

  // --- Sessions ---
  sessions: {
    list: '/sessions',
    active: '/sessions/active',
    statistics: '/sessions/statistics',
    sync: '/sessions/sync',
    byWifiAccount: (wifiAccountId: string) => `/sessions/wifi-account/${wifiAccountId}`,
    get: (id: string) => `/sessions/${id}`,
  },

  // --- Dashboard ---
  dashboard: {
    myStats: '/dashboard/my-stats',
    stats: '/dashboard/stats',
    charts: (days: number) => `/dashboard/charts?days=${days}`,
  },

  // --- MikroTik ---
  mikrotik: {
    status: '/mikrotik/status',
    users: '/mikrotik/users',
    user: (name: string) => `/mikrotik/users/${encodeURIComponent(name)}`,
    userDisable: (name: string) => `/mikrotik/users/${encodeURIComponent(name)}/disable`,
    userEnable: (name: string) => `/mikrotik/users/${encodeURIComponent(name)}/enable`,
    active: '/mikrotik/active',
    activeDisconnect: (sessionId: string) => `/mikrotik/active/${sessionId}`,
  },

  // --- Bandwidth ---
  bandwidth: {
    realtime: '/bandwidth/realtime',
    stats: '/bandwidth/stats',
    user: (username: string) => `/bandwidth/user/${encodeURIComponent(username)}`,
    history: (days: number) => `/bandwidth/history?days=${days}`,
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
    reserve: (id: string) => `/tickets/${id}/reserve`,
    release: (id: string) => `/tickets/${id}/release`,
    webhookPayment: '/tickets/webhook/payment',
  },

  // --- Admin Tickets (préfixe /admin/tickets) ---
  adminTickets: {
    import: '/admin/tickets/import',
    stats: '/admin/tickets/stats',
    updatePrice: (ticketId: string) => `/admin/tickets/${ticketId}/price`,
    delete: (ticketId: string) => `/admin/tickets/${ticketId}`,
  },

  // --- Tickets Admin (préfixe /tickets/admin, alternatif backend) ---
  ticketsAdmin: {
    import: '/tickets/admin/import',
    stats: '/tickets/admin/stats',
    updatePrice: (ticketId: string) => `/tickets/admin/${ticketId}/price`,
    delete: (ticketId: string) => `/tickets/admin/${ticketId}`,
  },
} as const
