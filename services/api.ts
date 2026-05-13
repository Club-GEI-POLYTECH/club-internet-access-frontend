// Service API utilisant axios (compatible avec le code existant)
import axios from 'axios'
import { getToken, removeToken } from '@/lib/auth'
import { getApiUrl } from '@/lib/api-endpoints'
import { formatApiConnectionError } from '@/lib/api-errors'
import { logger } from '@/lib/logger'
import type { InitiateKelpayPaymentRequest, InitiateKelpayPaymentResponse } from '@/types/frontend-types'

const API_URL = getApiUrl()

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = getToken()
  logger.debug('API (axios): requête', { method: config.method, url: config.url, hasToken: !!token })
  if (token) {
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
      logger.warn('API (axios): 401, déconnexion et redirection /login')
      removeToken()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    if (error.response?.data?.message) {
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
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },

  register: async (data: any) => {
    const response = await api.post('/auth/register', data)
    return response.data
  },

  sendRegisterEmailCode: async (email: string) => {
    const response = await api.post('/auth/register/send-email-code', { email: email.trim().toLowerCase() })
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
    const response = await api.post('/auth/reset-password', { token, newPassword })
    return response.data
  },
}

export const paymentsService = {
  getAll: async () => {
    const response = await api.get('/payments')
    return response.data
  },

  getById: async (id: string) => {
    const response = await api.get(`/payments/${id}`)
    return response.data
  },

  create: async (data: any) => {
    const response = await api.post('/payments', data)
    return response.data
  },

  complete: async (id: string, transactionId?: string) => {
    const response = await api.post(`/payments/${id}/complete`, { transactionId })
    return response.data
  },

  initiateKelpay: async (data: InitiateKelpayPaymentRequest): Promise<InitiateKelpayPaymentResponse> => {
    const response = await api.post<InitiateKelpayPaymentResponse>('/payments/initiate', data)
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
