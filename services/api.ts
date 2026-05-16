// Service API utilisant axios (compatible avec le code existant)
import '@/types/axios-augment'
import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { getToken, removeToken } from '@/lib/auth'
import { isAuthApiPathExpecting401, isOnAuthPublicPage } from '@/lib/api-session-401'
import { getApiUrl } from '@/lib/api-endpoints'
import { formatApiConnectionError } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import type { Payment, RegisterInitRequest, RegisterVerifyRequest, LoginResponse } from '@/types/api'
import type {
  InitiateKelpayPaymentRequest,
  InitiateKelpayPaymentResponse,
  KelpayConfirmPaymentResponse,
  KelpayVerifyPaymentResponse,
} from '@/types/frontend-types'

const API_URL = getApiUrl()

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** Repli si `config.url` est vide ou atypique : détecte login / verify / reset sur l’URL finale. */
function isAuthRouteWhere401IsNotSessionExpiry(config: InternalAxiosRequestConfig | undefined): boolean {
  if (!config) return false
  const rawUrl = config.url
  if (!rawUrl) return false
  let path = ''
  try {
    path = /^https?:\/\//i.test(rawUrl)
      ? new URL(rawUrl).pathname
      : (() => {
          const base = (config.baseURL || '').replace(/\/+$/, '')
          const rel = rawUrl.replace(/^\/+/, '')
          const combined = base ? `${base}/${rel}` : `/${rel}`
          return new URL(combined, 'https://placeholder.local').pathname
        })()
  } catch {
    path = `${config.baseURL || ''}${rawUrl}`.toLowerCase()
  }
  return isAuthApiPathExpecting401(path)
}

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = getToken()
  const skipAuthHeader =
    config.skipSessionInvalidationOn401 === true || isAuthRouteWhere401IsNotSessionExpiry(config)
  logger.debug('API (axios): requête', {
    method: config.method,
    url: config.url,
    hasToken: !!token,
    skipAuthHeader,
  })
  if (token && !skipAuthHeader) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepteur pour gérer les erreurs avec messages améliorés
api.interceptors.response.use(
  (response) => {
    logger.debug('API (axios): réponse', { url: response.config.url, status: response.status })
    return response
  },
  (error) => {
    logger.error('API (axios): erreur', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    })
    if (error.response?.status === 401) {
      const cfg = error.config
      const skipRedirect =
        cfg?.skipSessionInvalidationOn401 === true || isAuthRouteWhere401IsNotSessionExpiry(cfg)
      if (skipRedirect) {
        logger.debug('API (axios): 401 attendu (auth), pas de redirection', {
          url: cfg?.url,
          baseURL: cfg?.baseURL,
          flag: cfg?.skipSessionInvalidationOn401,
        })
      } else {
        logger.warn('API (axios): 401, session invalide — déconnexion', {
          url: cfg?.url,
          onPublicAuthPage: isOnAuthPublicPage(),
        })
        removeToken()
        if (typeof window !== 'undefined' && !isOnAuthPublicPage()) {
          window.location.href = '/login'
        }
      }
    }
    if (error.response?.status === 429) {
      const m = error.response?.data?.message
      const fromApi = Array.isArray(m) ? m.join(', ') : m
      error.message =
        fromApi && String(fromApi).trim()
          ? String(fromApi).trim()
          : 'Trop de tentatives ou trop de requêtes. Patientez quelques instants avant de réessayer.'
    } else if (error.response?.status === 503) {
      const m = error.response?.data?.message
      const fromApi = Array.isArray(m) ? m.join(', ') : m
      error.message =
        fromApi && String(fromApi).trim()
          ? String(fromApi).trim()
          : 'Service temporairement indisponible. Réessayez dans quelques minutes.'
    } else if (error.response?.data?.message) {
      error.message = error.response.data.message
    } else if (!error.response) {
      error.message = formatApiConnectionError(error).message
    }
    return Promise.reject(error)
  }
)

export const authService = {
  setToken: (token: string | null) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete api.defaults.headers.common['Authorization']
    }
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password }, {
      skipSessionInvalidationOn401: true,
    })
    return response.data
  },

  registerRequest: async (data: RegisterInitRequest) => {
    const body: RegisterInitRequest = {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
    }
    const response = await api.post('/auth/register/request', body)
    return response.data
  },

  registerVerify: async (data: RegisterVerifyRequest): Promise<LoginResponse> => {
    const response = await api.post(
      '/auth/register/verify',
      {
        email: data.email.trim().toLowerCase(),
        code: data.code.trim(),
      },
      { skipSessionInvalidationOn401: true },
    )
    return response.data
  },

  registerResend: async (email: string) => {
    const response = await api.post('/auth/register/resend', { email: email.trim().toLowerCase() })
    return response.data
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile')
    return response.data
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email })
    return response.data
  },

  resetPassword: async (token: string, newPassword: string) => {
    const response = await api.post(
      '/auth/reset-password',
      { token, newPassword },
      { skipSessionInvalidationOn401: true },
    )
    return response.data
  },
}

export const paymentsService = {
  getAll: async () => {
    const response = await api.get('/payments', { params: { page: 1, limit: 500 } })
    const raw = response.data
    if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
      return (raw as { data: unknown[] }).data
    }
    return Array.isArray(raw) ? raw : []
  },

  getById: async (id: string) => {
    const response = await api.get(`/payments/${id}`)
    return response.data
  },

  create: async (data: any) => {
    const response = await api.post('/payments', data)
    return response.data
  },

  complete: async (id: string, transactionId: string) => {
    const response = await api.post(`/payments/${id}/complete`, {
      transactionId: transactionId.trim(),
    })
    return response.data
  },

  initiateKelpay: async (data: InitiateKelpayPaymentRequest): Promise<InitiateKelpayPaymentResponse> => {
    const response = await api.post<InitiateKelpayPaymentResponse>('/payments/initiate', data)
    return response.data
  },

  verifyKelpay: async (paymentId: string): Promise<KelpayVerifyPaymentResponse> => {
    const response = await api.post<KelpayVerifyPaymentResponse>(`/payments/${paymentId}/kelpay/verify`, {})
    return response.data
  },

  confirmKelpay: async (paymentId: string): Promise<KelpayConfirmPaymentResponse> => {
    const response = await api.post<KelpayConfirmPaymentResponse>(`/payments/${paymentId}/kelpay/confirm`, {})
    return response.data
  },

  cancelKelpay: async (paymentId: string): Promise<Payment> => {
    const response = await api.post<Payment>(`/payments/${paymentId}/kelpay/cancel`, {})
    return response.data
  },
}

export const dashboardService = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats')
    return response.data
  },

  getCharts: async (days: number = 7) => {
    const response = await api.get(`/dashboard/charts?days=${days}`)
    return response.data
  },
}

export default api
