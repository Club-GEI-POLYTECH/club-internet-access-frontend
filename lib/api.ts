// Fonction principale pour les appels API
import { getToken, removeToken } from './auth'
import { getApiUrl } from './api-endpoints'
import { formatApiConnectionError, isLikelyNetworkOrBackendDown } from './api-errors'
import { USER_GENERIC_ERROR, USER_INVALID_RESPONSE, USER_SERVICE_UNAVAILABLE } from './user-messages'

const API_URL = getApiUrl()

export interface ApiError {
  message: string
  status?: number
  data?: any
}

/**
 * Fonction principale pour effectuer des requêtes API
 * Gère automatiquement l'authentification et les erreurs
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const url = `${API_URL}${endpoint}`

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...(options.body && typeof options.body === 'object'
        ? { body: JSON.stringify(options.body) }
        : { body: options.body }),
    })
  } catch (error) {
    throw formatApiConnectionError(error)
  }

  try {
    // Gestion des erreurs HTTP
    if (response.status === 401) {
      removeToken()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Session expirée. Veuillez vous reconnecter.') as ApiError
    }

    if (response.status === 403) {
      const error: ApiError = {
        message: 'Accès refusé. Permissions insuffisantes.',
        status: 403,
      }
      throw error
    }

    if (response.status === 404) {
      const error: ApiError = {
        message: 'Ressource non trouvée.',
        status: 404,
      }
      throw error
    }

    if (!response.ok) {
      let errorMessage = USER_GENERIC_ERROR
      try {
        const error = await response.json()
        const fromApi = error.message
        if (fromApi && String(fromApi).trim() && String(fromApi).length <= 200) {
          errorMessage = String(fromApi).trim()
        }
      } catch {
        if (response.status >= 502 && response.status <= 504) {
          errorMessage = USER_SERVICE_UNAVAILABLE
        }
      }
      throw new Error(errorMessage) as ApiError
    }

    if (response.status === 204) {
      return {} as T
    }

    try {
      return await response.json()
    } catch {
      throw new Error(USER_INVALID_RESPONSE) as ApiError
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      throw error
    }
    if (isLikelyNetworkOrBackendDown(error)) {
      throw formatApiConnectionError(error)
    }
    if (error instanceof Error) {
      throw { message: error.message, status: undefined } as ApiError
    }
    throw { message: USER_GENERIC_ERROR, status: undefined } as ApiError
  }
}

/**
 * Méthodes HTTP simplifiées
 */
export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  
  post: <T>(endpoint: string, data?: any) => 
    apiRequest<T>(endpoint, { method: 'POST', body: data }),
  
  put: <T>(endpoint: string, data?: any) => 
    apiRequest<T>(endpoint, { method: 'PUT', body: data }),
  
  patch: <T>(endpoint: string, data?: any) => 
    apiRequest<T>(endpoint, { method: 'PATCH', body: data }),
  
  delete: <T>(endpoint: string) => 
    apiRequest<T>(endpoint, { method: 'DELETE' }),
}
