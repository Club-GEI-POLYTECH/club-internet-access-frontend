'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authService } from '@/services/api'
import { getToken, setToken as setAuthToken, removeToken } from '@/lib/auth'
import { isOnAuthPublicPage } from '@/lib/api-session-401'
import { logger } from '@/lib/logger'
import type { User, LoginResponse } from '@/types/api'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  /** Après `POST /auth/register/verify` : applique le JWT sans refaire un login. */
  applyAuthResponse: (response: LoginResponse) => void
  /** Recharge le profil depuis `GET /auth/profile` (ex. après `PUT /users/:id`). */
  refreshUser: () => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    logger.log('AuthContext: initialisation, vérification du token')
    const storedToken = getToken()
    setToken(storedToken)
    if (storedToken) {
      authService.setToken(storedToken)
      if (isOnAuthPublicPage()) {
        logger.log('AuthContext: token présent sur page auth publique, pas de fetchProfile')
        setLoading(false)
      } else {
        logger.info('AuthContext: token trouvé, chargement du profil')
        fetchProfile()
      }
    } else {
      logger.log('AuthContext: aucun token, utilisateur non connecté')
      setLoading(false)
    }
  }, [])

  const fetchProfile = async () => {
    try {
      logger.log('AuthContext: fetchProfile en cours')
      const profile = await authService.getProfile()
      setUser(profile)
      logger.info('AuthContext: profil chargé', { email: profile.email, role: profile.role })
    } catch (error) {
      logger.warn('AuthContext: fetchProfile échoué, suppression du token', error)
      removeToken()
      setToken(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    const t = getToken()
    if (!t) return
    try {
      authService.setToken(t)
      const profile = await authService.getProfile()
      setUser(profile)
    } catch {
      /* ne pas invalider la session si le profil échoue ponctuellement */
    }
  }

  const applyAuthResponse = (response: LoginResponse) => {
    setToken(response.access_token)
    setUser(response.user)
    setAuthToken(response.access_token)
    authService.setToken(response.access_token)
  }

  const login = async (email: string, password: string) => {
    logger.log('AuthContext: tentative de connexion', { email })
    try {
      const response: LoginResponse = await authService.login(email, password)
      applyAuthResponse(response)
      logger.info('AuthContext: connexion réussie', { email: response.user.email, role: response.user.role })
    } catch (error) {
      logger.error('AuthContext: connexion échouée', { email }, error)
      throw error
    }
  }

  const logout = () => {
    logger.log('AuthContext: déconnexion')
    setToken(null)
    setUser(null)
    removeToken()
    authService.setToken(null)
    if (typeof window !== 'undefined') {
      logger.info('AuthContext: redirection vers /login')
      window.location.href = '/login'
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, login, applyAuthResponse, refreshUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
