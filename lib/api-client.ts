/**
 * Client API réutilisable pour Next.js
 * 
 * Ce fichier fournit une interface client complète pour toutes les APIs backend
 * 
 * Usage:
 * import { apiClient } from '@/lib/api-client';
 * const accounts = await apiClient.wifiAccounts.list();
 */

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  WiFiAccount,
  CreateWiFiAccountRequest,
  Payment,
  CreatePaymentRequest,
  CompletePaymentRequest,
  UpdatePaymentStatusRequest,
  Session,
  SessionStatistics,
  DashboardStats,
  ChartData,
  MikroTikStatus,
  MikroTikHotspotUser,
  MikroTikActiveUser,
  CreateMikroTikUserRequest,
  BandwidthRealtime,
  BandwidthStats,
  UserBandwidth,
  BandwidthHistory,
  ApiError,
  Ticket,
  TicketStatus,
  TicketType,
  TicketPurchaseRequest,
  TicketPurchaseResponse,
} from '@/types/api'

import { getApiUrl } from './api-endpoints'
import { logger } from './logger'

//const API_URL = getApiUrl()
const API_URL = process.env.NEXT_PUBLIC_API_URL
console.log('API_URL', API_URL)

/**
 * Fonction utilitaire pour gérer les tokens
 */
const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  
  // Option 1: Cookies (recommandé)
  const cookies = document.cookie.split(';')
  const tokenCookie = cookies.find(c => c.trim().startsWith('token='))
  if (tokenCookie) {
    return tokenCookie.split('=')[1]
  }
  
  // Option 2: localStorage (fallback)
  return localStorage.getItem('token')
}

const setToken = (token: string): void => {
  if (typeof window === 'undefined') return
  
  // Option 1: Cookies
  document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  
  // Option 2: localStorage (fallback)
  localStorage.setItem('token', token)
}

const removeToken = (): void => {
  if (typeof window === 'undefined') return
  
  // Supprimer cookie
  document.cookie = 'token=; path=/; max-age=0'
  
  // Supprimer localStorage
  localStorage.removeItem('token')
}

/**
 * Fonction de base pour les requêtes API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const url = `${API_URL}${endpoint}`
  logger.log('API: requête', { method, endpoint, url })

  const token = getToken()
  if (token) logger.debug('API: token présent pour la requête')

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  logger.log('API: réponse', { endpoint, status: response.status, ok: response.ok })

  // Gestion des erreurs HTTP
  if (response.status === 401) {
    logger.warn('API: 401 Unauthorized, déconnexion et redirection /login')
    removeToken()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Session expirée. Veuillez vous reconnecter.')
  }

  if (response.status === 403) {
    logger.warn('API: 403 Forbidden', { endpoint })
    throw new Error('Accès refusé. Permissions insuffisantes.')
  }

  if (response.status === 404) {
    logger.warn('API: 404 Not Found', { endpoint })
    throw new Error('Ressource non trouvée.')
  }

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      statusCode: response.status,
      message: `Erreur ${response.status}`,
      error: 'Unknown error',
    }))
    logger.error('API: erreur', { endpoint, status: response.status }, error)
    throw new Error(
      Array.isArray(error.message) 
        ? error.message.join(', ') 
        : error.message || `Erreur ${response.status}`
    )
  }

  const data = await response.json()
  logger.debug('API: succès', { endpoint })
  return data as T
}

/**
 * Client API avec toutes les méthodes (aligné sur les routes backend)
 */
export const apiClient = {
  // ============================================
  // APP (health, root)
  // ============================================
  app: {
    health: async (): Promise<{ status?: string }> => {
      return apiRequest<{ status?: string }>('/health')
    },

    root: async (): Promise<{ name?: string; description?: string }> => {
      return apiRequest('/')
    },
  },

  // ============================================
  // AUTHENTIFICATION
  // ============================================
  auth: {
    login: async (data: LoginRequest): Promise<LoginResponse> => {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      setToken(response.access_token)
      return response
    },

    register: async (data: RegisterRequest): Promise<User> => {
      return apiRequest<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    getProfile: async (): Promise<User> => {
      return apiRequest<User>('/auth/profile')
    },

    forgotPassword: async (email: string): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    },

    resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
    },

    logout: (): void => {
      removeToken()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    },
  },

  // ============================================
  // WIFI ACCOUNTS
  // ============================================
  wifiAccounts: {
    list: async (): Promise<WiFiAccount[]> => {
      return apiRequest<WiFiAccount[]>('/wifi-accounts')
    },

    getActive: async (): Promise<WiFiAccount[]> => {
      return apiRequest<WiFiAccount[]>('/wifi-accounts/active')
    },

    getById: async (id: string): Promise<WiFiAccount> => {
      return apiRequest<WiFiAccount>(`/wifi-accounts/${id}`)
    },

    create: async (data: CreateWiFiAccountRequest): Promise<WiFiAccount> => {
      return apiRequest<WiFiAccount>('/wifi-accounts', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    delete: async (id: string): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>(`/wifi-accounts/${id}`, {
        method: 'DELETE',
      })
    },
  },

  // ============================================
  // PAYMENTS
  // ============================================
  payments: {
    list: async (): Promise<Payment[]> => {
      return apiRequest<Payment[]>('/payments')
    },

    getById: async (id: string): Promise<Payment> => {
      return apiRequest<Payment>(`/payments/${id}`)
    },

    getByTransactionId: async (transactionId: string): Promise<Payment> => {
      return apiRequest<Payment>(`/payments/transaction/${transactionId}`)
    },

    create: async (data: CreatePaymentRequest): Promise<Payment> => {
      return apiRequest<Payment>('/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    complete: async (id: string, data?: CompletePaymentRequest): Promise<Payment> => {
      return apiRequest<Payment>(`/payments/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      })
    },

    updateStatus: async (id: string, status: UpdatePaymentStatusRequest['status']): Promise<Payment> => {
      return apiRequest<Payment>(`/payments/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
    },
  },

  // ============================================
  // SESSIONS
  // ============================================
  sessions: {
    list: async (): Promise<Session[]> => {
      return apiRequest<Session[]>('/sessions')
    },

    getActive: async (): Promise<Session[]> => {
      return apiRequest<Session[]>('/sessions/active')
    },

    getStatistics: async (): Promise<SessionStatistics> => {
      return apiRequest<SessionStatistics>('/sessions/statistics')
    },

    sync: async (): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>('/sessions/sync', {
        method: 'POST',
      })
    },

    getByWiFiAccount: async (wifiAccountId: string): Promise<Session[]> => {
      return apiRequest<Session[]>(`/sessions/wifi-account/${wifiAccountId}`)
    },

    getById: async (id: string): Promise<Session> => {
      return apiRequest<Session>(`/sessions/${id}`)
    },
  },

  // ============================================
  // DASHBOARD
  // ============================================
  dashboard: {
    /** Stats pour l'utilisateur connecté (mon dashboard) */
    getMyStats: async (): Promise<DashboardStats> => {
      return apiRequest<DashboardStats>('/dashboard/my-stats')
    },

    /** Stats globales (admin/agent) */
    getStats: async (): Promise<DashboardStats> => {
      return apiRequest<DashboardStats>('/dashboard/stats')
    },

    getCharts: async (days: number = 7): Promise<ChartData> => {
      return apiRequest<ChartData>(`/dashboard/charts?days=${days}`)
    },
  },

  // ============================================
  // MIKROTIK
  // ============================================
  mikrotik: {
    getStatus: async (): Promise<MikroTikStatus> => {
      return apiRequest<MikroTikStatus>('/mikrotik/status')
    },

    createUser: async (data: CreateMikroTikUserRequest): Promise<MikroTikHotspotUser> => {
      return apiRequest<MikroTikHotspotUser>('/mikrotik/users', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    listUsers: async (): Promise<MikroTikHotspotUser[]> => {
      return apiRequest<MikroTikHotspotUser[]>('/mikrotik/users')
    },

    getUser: async (username: string): Promise<MikroTikHotspotUser> => {
      return apiRequest<MikroTikHotspotUser>(`/mikrotik/users/${username}`)
    },

    deleteUser: async (username: string): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>(`/mikrotik/users/${username}`, {
        method: 'DELETE',
      })
    },

    getActiveUsers: async (): Promise<MikroTikActiveUser[]> => {
      return apiRequest<MikroTikActiveUser[]>('/mikrotik/active')
    },

    disconnectUser: async (sessionId: string): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>(`/mikrotik/active/${sessionId}`, {
        method: 'DELETE',
      })
    },

    disableUser: async (username: string): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>(`/mikrotik/users/${username}/disable`, {
        method: 'POST',
      })
    },

    enableUser: async (username: string): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>(`/mikrotik/users/${username}/enable`, {
        method: 'POST',
      })
    },
  },

  // ============================================
  // BANDWIDTH
  // ============================================
  bandwidth: {
    getRealtime: async (): Promise<BandwidthRealtime> => {
      return apiRequest<BandwidthRealtime>('/bandwidth/realtime')
    },

    getStats: async (): Promise<BandwidthStats> => {
      return apiRequest<BandwidthStats>('/bandwidth/stats')
    },

    getUserBandwidth: async (username: string): Promise<UserBandwidth> => {
      return apiRequest<UserBandwidth>(`/bandwidth/user/${username}`)
    },

    getHistory: async (days: number = 7): Promise<BandwidthHistory[]> => {
      return apiRequest<BandwidthHistory[]>(`/bandwidth/history?days=${days}`)
    },
  },

  // ============================================
  // TICKETS (pré-générés depuis Mikhmon)
  // ============================================
  tickets: {
    list: async (status?: TicketStatus): Promise<Ticket[]> => {
      const query = status ? `?status=${status}` : ''
      return apiRequest<Ticket[]>(`/tickets${query}`)
    },

    getAvailable: async (): Promise<Ticket[]> => {
      return apiRequest<Ticket[]>('/tickets/available')
    },

    getTypes: async (): Promise<TicketType[]> => {
      return apiRequest<TicketType[]>('/tickets/types')
    },

    getTypeById: async (typeId: string): Promise<TicketType> => {
      return apiRequest<TicketType>(`/tickets/types/${typeId}`)
    },

    getByType: async (typeId: string): Promise<Ticket[]> => {
      return apiRequest<Ticket[]>(`/tickets/type/${typeId}`)
    },

    getById: async (id: string): Promise<Ticket> => {
      return apiRequest<Ticket>(`/tickets/${id}`)
    },

    purchase: async (data: TicketPurchaseRequest): Promise<TicketPurchaseResponse> => {
      return apiRequest<TicketPurchaseResponse>('/tickets/purchase', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    reserve: async (id: string): Promise<Ticket> => {
      return apiRequest<Ticket>(`/tickets/${id}/reserve`, {
        method: 'POST',
      })
    },

    release: async (id: string): Promise<Ticket> => {
      return apiRequest<Ticket>(`/tickets/${id}/release`, {
        method: 'POST',
      })
    },
  },

  // ============================================
  // ADMIN - TICKETS
  // ============================================
  admin: {
    tickets: {
      import: async (
        file: File,
        defaultPrice?: number
      ): Promise<{ imported: number; failed: number; errors: string[] }> => {
        const token = getToken()
        const formData = new FormData()
        formData.append('file', file)
        if (defaultPrice != null) {
          formData.append('defaultPrice', String(defaultPrice))
        }
        console.log(`${API_URL}/tickets/admin/import`)

        const response = await fetch(`${API_URL}/tickets/admin/import`, {
          method: 'POST',
          body: formData,
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({
            message: `Erreur ${response.status}`,
          }))
          throw new Error(error.message || `Erreur ${response.status}`)
        }

        return response.json()
      },

      list: async (): Promise<Ticket[]> => {
        return apiRequest<Ticket[]>('/admin/tickets')
      },

      getStats: async (): Promise<{
        total: number
        available: number
        sold: number
        reserved: number
        revenue: number
      }> => {
        return apiRequest('/admin/tickets/stats')
      },

      updatePrice: async (ticketId: string, price: number): Promise<Ticket> => {
        return apiRequest<Ticket>(`/admin/tickets/${ticketId}/price`, {
          method: 'PUT',
          body: JSON.stringify({ price }),
        })
      },

      delete: async (ticketId: string): Promise<{ message?: string }> => {
        return apiRequest<{ message?: string }>(`/admin/tickets/${ticketId}`, {
          method: 'DELETE',
        })
      },
    },
  },

  // ============================================
  // USERS (système)
  // ============================================
  users: {
    list: async (): Promise<User[]> => {
      return apiRequest<User[]>('/users')
    },

    getById: async (id: string): Promise<User> => {
      return apiRequest<User>(`/users/${id}`)
    },

    create: async (data: Partial<User>): Promise<User> => {
      return apiRequest<User>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    update: async (id: string, data: Partial<User>): Promise<User> => {
      return apiRequest<User>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },

    delete: async (id: string): Promise<{ message: string }> => {
      return apiRequest<{ message: string }>(`/users/${id}`, {
        method: 'DELETE',
      })
    },
  },
}

// Export des utilitaires
export { getToken, setToken, removeToken, apiRequest }
