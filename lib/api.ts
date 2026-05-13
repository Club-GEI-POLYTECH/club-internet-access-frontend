// Fonction principale pour les appels API
import { getToken, removeToken } from './auth'
import { getApiUrl } from './api-endpoints'
import { formatApiConnectionError, isLikelyNetworkOrBackendDown } from './api-errors'

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
      let errorMessage = `Erreur ${response.status}`
      try {
        const error = await response.json()
        errorMessage = error.message || errorMessage
      } catch {
        if (response.status >= 502 && response.status <= 504) {
          errorMessage =
            "Le serveur d'API ne répond pas correctement. Vérifiez qu'il est démarré et joignable."
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
      throw new Error(
        "Réponse invalide du serveur d'API (JSON attendu). Le service est peut-être indisponible."
      ) as ApiError
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
    throw { message: 'Erreur inattendue lors de la communication avec le serveur.', status: undefined } as ApiError
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
