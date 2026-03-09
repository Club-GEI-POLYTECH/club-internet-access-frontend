// Fonction principale pour les appels API
import { getToken, removeToken } from './auth'
import { getApiUrl } from './api-endpoints'

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

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
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
        status: 403
      }
      throw error
    }

    if (response.status === 404) {
      const error: ApiError = {
        message: 'Ressource non trouvée.',
        status: 404
      }
      throw error
    }

    if (!response.ok) {
      let errorMessage = `Erreur ${response.status}`
      try {
        const error = await response.json()
        errorMessage = error.message || errorMessage
      } catch {
        // Si la réponse n'est pas du JSON, utiliser le message par défaut
      }
      throw new Error(errorMessage) as ApiError
    }

    // Si la réponse est vide (204 No Content)
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error) {
      const apiError: ApiError = {
        message: error.message,
        status: undefined
      }
      throw apiError
    }
    const networkError: ApiError = {
      message: 'Erreur réseau. Vérifiez votre connexion.',
      status: undefined
    }
    throw networkError
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
