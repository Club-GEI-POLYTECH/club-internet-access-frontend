'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/api'

type PrivateRouteProps = {
  children: React.ReactNode
  /** Si défini, seuls ces rôles accèdent à la page ; les autres sont redirigés vers `/dashboard`. */
  allowedRoles?: UserRole[]
}

export default function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      logger.info('PrivateRoute: non authentifié, redirection vers /login')
      router.push('/login')
    } else if (user) {
      logger.debug('PrivateRoute: accès autorisé', { email: user.email, role: user.role })
    }
  }, [user, loading, router])

  useEffect(() => {
    if (loading || !user || !allowedRoles?.length) return
    if (!allowedRoles.includes(user.role)) {
      logger.warn('PrivateRoute: rôle non autorisé, redirection /dashboard', {
        role: user.role,
        allowedRoles,
      })
      router.replace('/dashboard')
    }
  }, [user, loading, allowedRoles, router])

  if (loading) {
    logger.debug('PrivateRoute: chargement auth en cours')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    logger.log('PrivateRoute: pas d\'utilisateur, rendu null')
    return null
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return <>{children}</>
}
