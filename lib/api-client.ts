/**
 * Client API réutilisable pour Next.js (vente de tickets, paiements, dashboard).
 *
 * Usage:
 * import { apiClient } from '@/lib/api-client';
 */

import type {
  LoginRequest,
  LoginResponse,
  RegisterInitRequest,
  RegisterVerifyRequest,
  User,
  Payment,
  CreatePaymentRequest,
  CompletePaymentRequest,
  UpdatePaymentStatusRequest,
  DashboardStats,
  ChartData,
  ApiError,
  Ticket,
  TicketStatus,
  TicketType,
  AdminTicketsStats,
  TicketPurchaseRequest,
  TicketPurchaseResponse,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/types/api'
import type {
  InitiateKelpayPaymentRequest,
  InitiateKelpayPaymentResponse,
  KelpayConfirmPaymentResponse,
  KelpayVerifyPaymentResponse,
  ImportTicketsMultipartOptions,
} from '@/types/frontend-types'

import { getApiUrl, API_ENDPOINTS } from './api-endpoints'
import { logger } from './logger'
import { formatApiConnectionError } from './api-errors'
import {
  normalizeTicket,
  normalizeTicketList,
  normalizeTicketType,
  normalizeTicketTypeList,
} from './normalize-ticket-api'
import { normalizeAdminTicketsStats } from './normalize-admin-ticket-stats'

const API_URL = getApiUrl()

function createTicketImportFormData(file: File, options?: ImportTicketsMultipartOptions): FormData {
  const formData = new FormData()
  formData.append('file', file)
  if (!options) return formData
  if (options.ticketTypeId) {
    formData.append('ticketTypeId', options.ticketTypeId)
    return formData
  }
  if (options.catalogDuration) {
    formData.append('catalogDuration', options.catalogDuration)
  }
  return formData
}

/** POST import CSV : route canonique `/admin/tickets/...`, repli 404 sur `/tickets/admin/...`. */
async function postAdminTicketImportMultipart(
  file: File,
  options: ImportTicketsMultipartOptions | undefined,
  token: string | null,
  primaryPath: string,
  legacyPath: string,
): Promise<Response> {
  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
  }
  let response = await fetchApi(`${API_URL}${primaryPath}`, {
    method: 'POST',
    body: createTicketImportFormData(file, options),
    headers,
  })
  if (response.status === 404) {
    response = await fetchApi(`${API_URL}${legacyPath}`, {
      method: 'POST',
      body: createTicketImportFormData(file, options),
      headers,
    })
  }
  return response
}

type TicketImportRecommendations = {
  recommendations: Array<{
    durationKey: string
    label: string
    count: number
    recommendedPrice: number
    action: 'use_existing' | 'create_new' | string
  }>
  totalLines?: number
  validLines?: number
  invalidLines?: number
}

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null

  const cookies = document.cookie.split(';')
  const tokenCookie = cookies.find(c => c.trim().startsWith('token='))
  if (tokenCookie) {
    return tokenCookie.split('=')[1]
  }

  return localStorage.getItem('token')
}

const setToken = (token: string): void => {
  if (typeof window === 'undefined') return

  document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`

  localStorage.setItem('token', token)
}

const removeToken = (): void => {
  if (typeof window === 'undefined') return

  document.cookie = 'token=; path=/; max-age=0'

  localStorage.removeItem('token')
}

async function fetchApi(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    logger.error('API: connexion impossible', { url }, error)
    throw formatApiConnectionError(error)
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const url = `${API_URL}${endpoint}`
  logger.log('API: requête', { method, endpoint, url })

  const token = getToken()
  if (token) logger.debug('API: token présent pour la requête')

  const response = await fetchApi(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  logger.log('API: réponse', { endpoint, status: response.status, ok: response.ok })

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
    let message = `Erreur ${response.status}`
    try {
      const error: ApiError = await response.json()
      logger.error('API: erreur', { endpoint, status: response.status }, error)
      message = Array.isArray(error.message) ? error.message.join(', ') : error.message || message
    } catch {
      logger.warn('API: corps d’erreur non JSON', { endpoint, status: response.status })
      if (response.status >= 502 && response.status <= 504) {
        message =
          "Le serveur d'API ne répond pas correctement (passerelle / timeout). Vérifiez qu'il est démarré et joignable."
      } else if (response.status >= 500) {
        message = "Erreur côté serveur d'API. Consultez les logs du backend."
      }
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    logger.debug('API: 204 No Content', { endpoint })
    return {} as T
  }

  try {
    const data = await response.json()
    logger.debug('API: succès', { endpoint })
    return data as T
  } catch (error) {
    logger.error('API: réponse OK mais JSON illisible', { endpoint }, error)
    throw new Error(
      "Réponse invalide du serveur d'API (JSON attendu). Le service est peut-être indisponible ou en maintenance."
    )
  }
}

export const apiClient = {
  app: {
    health: async (): Promise<{ status?: string }> => {
      return apiRequest<{ status?: string }>('/health')
    },

    root: async (): Promise<{ name?: string; description?: string }> => {
      return apiRequest('/')
    },
  },

  auth: {
    login: async (data: LoginRequest): Promise<LoginResponse> => {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      setToken(response.access_token)
      return response
    },

    /** POST /auth/register/request — enregistre l’intention + envoie le code e-mail (Postman). */
    registerRequest: async (data: RegisterInitRequest): Promise<{ message?: string }> => {
      const body: RegisterInitRequest = {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
      }
      return apiRequest<{ message?: string }>('/auth/register/request', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },

    /** POST /auth/register/verify — valide le code et retourne un JWT (Postman). */
    registerVerify: async (data: RegisterVerifyRequest): Promise<LoginResponse> => {
      const raw = await apiRequest<{ access_token: string; user?: User }>('/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          code: data.code.trim(),
        }),
      })
      setToken(raw.access_token)
      if (raw.user) {
        return { access_token: raw.access_token, user: raw.user }
      }
      const user = await apiRequest<User>('/auth/profile')
      return { access_token: raw.access_token, user }
    },

    /** POST /auth/register/resend — renvoie le code (Postman : `{ "email" }` seul). */
    registerResend: async (email: string): Promise<{ message?: string }> => {
      return apiRequest<{ message?: string }>('/auth/register/resend', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
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

    initiateKelpay: async (data: InitiateKelpayPaymentRequest): Promise<InitiateKelpayPaymentResponse> => {
      return apiRequest<InitiateKelpayPaymentResponse>('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    /** Un seul `checktransaction` côté serveur — à relancer si Kelpay est encore en attente. */
    verifyKelpay: async (paymentId: string): Promise<KelpayVerifyPaymentResponse> => {
      return apiRequest<KelpayVerifyPaymentResponse>(`/payments/${paymentId}/kelpay/verify`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },

    /** Idempotent : active la vente si Kelpay a confirmé ; `409` si pas encore prêt. */
    confirmKelpay: async (paymentId: string): Promise<KelpayConfirmPaymentResponse> => {
      return apiRequest<KelpayConfirmPaymentResponse>(`/payments/${paymentId}/kelpay/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },

    /** Annule un paiement KELPAY encore en attente et libère la réservation côté serveur (si implémenté). */
    cancelKelpay: async (paymentId: string): Promise<Payment> => {
      return apiRequest<Payment>(`/payments/${paymentId}/kelpay/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },
  },

  dashboard: {
    getMyStats: async (): Promise<DashboardStats> => {
      return apiRequest<DashboardStats>('/dashboard/my-stats')
    },

    getStats: async (): Promise<DashboardStats> => {
      return apiRequest<DashboardStats>('/dashboard/stats')
    },

    getCharts: async (days: number = 7): Promise<ChartData> => {
      return apiRequest<ChartData>(`/dashboard/charts?days=${days}`)
    },
  },

  users: {
    list: async (): Promise<User[]> => {
      const raw = await apiRequest<User[] | unknown>('/users')
      return Array.isArray(raw) ? raw : []
    },

    getById: async (id: string): Promise<User> => {
      return apiRequest<User>(`/users/${id}`)
    },

    create: async (data: CreateUserRequest): Promise<User> => {
      const body: CreateUserRequest = {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: data.role,
        ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
      }
      return apiRequest<User>('/users', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },

    update: async (id: string, data: UpdateUserRequest): Promise<User> => {
      return apiRequest<User>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },

    delete: async (id: string): Promise<void> => {
      await apiRequest<Record<string, never>>(`/users/${id}`, {
        method: 'DELETE',
      })
    },
  },

  tickets: {
    list: async (status?: TicketStatus): Promise<Ticket[]> => {
      const query = status ? `?status=${status}` : ''
      const raw = await apiRequest<Ticket[]>(`/tickets${query}`)
      return normalizeTicketList(raw)
    },

    getAvailable: async (): Promise<Ticket[]> => {
      const raw = await apiRequest<Ticket[]>('/tickets/available')
      return normalizeTicketList(raw)
    },

    getTypes: async (): Promise<TicketType[]> => {
      const raw = await apiRequest<TicketType[]>('/tickets/types')
      const rawList = Array.isArray(raw) ? raw : []
      if (!Array.isArray(raw)) {
        logger.warn('API tickets.getTypes: réponse inattendue (pas un tableau)', { typeof: typeof raw })
      }
      const first = rawList[0] as unknown as Record<string, unknown> | undefined
      logger.debug('API tickets.getTypes: acquisition (brut)', {
        endpoint: '/tickets/types',
        rawIsArray: Array.isArray(raw),
        count: rawList.length,
        sampleKeys: first ? Object.keys(first) : [],
        samplePrice: first?.price,
        samplePriceType: first?.price === undefined || first?.price === null ? 'absent' : typeof first.price,
      })
      const list = normalizeTicketTypeList(raw)
      logger.debug('API tickets.getTypes: après normalisation', {
        count: list.length,
        types: list.map((t) => ({
          id: t.id,
          name: t.name,
          price: t.price,
          availableCount: t.availableCount,
          isActive: t.isActive,
        })),
      })
      return list
    },

    getTypeById: async (typeId: string): Promise<TicketType> => {
      const raw = await apiRequest<TicketType>(`/tickets/types/${typeId}`)
      const r = raw as unknown as Record<string, unknown>
      logger.debug('API tickets.getTypeById: acquisition', {
        typeId,
        keys: raw && typeof raw === 'object' ? Object.keys(raw as object) : [],
        priceBrut: r?.price,
        priceType: r?.price === undefined || r?.price === null ? 'absent' : typeof r.price,
      })
      const normalized = normalizeTicketType(raw)
      logger.debug('API tickets.getTypeById: après normalisation', {
        typeId,
        id: normalized.id,
        name: normalized.name,
        price: normalized.price,
        availableCount: normalized.availableCount,
      })
      return normalized
    },

    getByType: async (typeId: string): Promise<Ticket[]> => {
      const raw = await apiRequest<Ticket[]>(`/tickets/type/${typeId}`)
      const rawList = Array.isArray(raw) ? raw : []
      if (!Array.isArray(raw)) {
        logger.warn('API tickets.getByType: réponse inattendue (pas un tableau)', { typeId, typeof: typeof raw })
      }
      const first = rawList[0] as unknown as Record<string, unknown> | undefined
      logger.debug('API tickets.getByType: acquisition (brut)', {
        typeId,
        endpoint: `/tickets/type/${typeId}`,
        rawIsArray: Array.isArray(raw),
        count: rawList.length,
        sampleKeys: first ? Object.keys(first) : [],
        samplePrice: first?.price,
        samplePriceType: first?.price === undefined || first?.price === null ? 'absent' : typeof first.price,
        sampleStatus: first?.status,
        sampleProfile: first?.profile,
      })
      const list = normalizeTicketList(raw)
      logger.debug('API tickets.getByType: après normalisation', {
        typeId,
        count: list.length,
        sample: list.slice(0, 12).map((t) => ({
          id: t.id,
          status: t.status,
          profile: t.profile,
          price: t.price,
        })),
      })
      return list
    },

    getById: async (id: string): Promise<Ticket> => {
      const raw = await apiRequest<Ticket>(`/tickets/${id}`)
      return normalizeTicket(raw)
    },

    purchase: async (data: TicketPurchaseRequest): Promise<TicketPurchaseResponse> => {
      const raw = await apiRequest<TicketPurchaseResponse>('/tickets/purchase', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return {
        ...raw,
        ticket: normalizeTicket(raw.ticket),
      }
    },

    mine: async (): Promise<Ticket[]> => {
      const raw = await apiRequest<Ticket[]>('/tickets/me')
      return normalizeTicketList(raw)
    },

    reserve: async (id: string): Promise<Ticket> => {
      const raw = await apiRequest<Ticket>(`/tickets/${id}/reserve`, {
        method: 'POST',
      })
      return normalizeTicket(raw)
    },

    release: async (id: string): Promise<Ticket> => {
      const raw = await apiRequest<Ticket>(`/tickets/${id}/release`, {
        method: 'POST',
      })
      return normalizeTicket(raw)
    },
  },

  admin: {
    tickets: {
      importRecommendations: async (
        file: File,
        options?: ImportTicketsMultipartOptions,
      ): Promise<TicketImportRecommendations> => {
        const token = getToken()
        const response = await postAdminTicketImportMultipart(
          file,
          options,
          token,
          API_ENDPOINTS.adminTickets.importRecommendations,
          API_ENDPOINTS.ticketsAdmin.importRecommendations,
        )

        if (!response.ok) {
          let message = `Erreur ${response.status}`
          try {
            const error = await response.json()
            message = error.message || message
          } catch {
            if (response.status >= 502 && response.status <= 504) {
              message =
                "Le serveur d'API ne répond pas (import). Vérifiez qu'il est démarré."
            }
          }
          throw new Error(message)
        }

        try {
          return await response.json()
        } catch (error) {
          logger.error('API: import recommendations — JSON invalide', error)
          throw new Error("Réponse invalide du serveur après l'analyse du fichier.")
        }
      },

      import: async (
        file: File,
        options?: ImportTicketsMultipartOptions,
      ): Promise<{ imported: number; failed: number; errors: string[] }> => {
        const token = getToken()
        const response = await postAdminTicketImportMultipart(
          file,
          options,
          token,
          API_ENDPOINTS.adminTickets.import,
          API_ENDPOINTS.ticketsAdmin.import,
        )

        if (!response.ok) {
          let message = `Erreur ${response.status}`
          try {
            const error = await response.json()
            message = error.message || message
          } catch {
            if (response.status >= 502 && response.status <= 504) {
              message =
                "Le serveur d'API ne répond pas (import). Vérifiez qu'il est démarré."
            }
          }
          throw new Error(message)
        }

        try {
          return await response.json()
        } catch (error) {
          logger.error('API: import CSV — JSON invalide', error)
          throw new Error("Réponse invalide du serveur après l'import.")
        }
      },

      list: async (): Promise<Ticket[]> => {
        const raw = await apiRequest<Ticket[]>('/admin/tickets')
        return normalizeTicketList(raw)
      },

      getStats: async (): Promise<AdminTicketsStats> => {
        const raw = await apiRequest<unknown>('/admin/tickets/stats')
        return normalizeAdminTicketsStats(raw)
      },

      updatePrice: async (ticketId: string, price: number): Promise<Ticket> => {
        const raw = await apiRequest<Ticket>(`/admin/tickets/${ticketId}/price`, {
          method: 'PUT',
          body: JSON.stringify({ price }),
        })
        return normalizeTicket(raw)
      },

      delete: async (ticketId: string): Promise<{ message?: string }> => {
        return apiRequest<{ message?: string }>(`/admin/tickets/${ticketId}`, {
          method: 'DELETE',
        })
      },
    },
  },
}

export { getToken, setToken, removeToken, apiRequest }
