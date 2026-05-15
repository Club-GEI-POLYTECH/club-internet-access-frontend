import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Si `true`, un **401** sur cette requête ne déclenche pas la déconnexion
     * ni `window.location.href = '/login'` (identifiants invalides, code erroné, etc.).
     */
    skipSessionInvalidationOn401?: boolean
  }
}

export {}
