'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/lib/logger'

/**
 * Point d'entrée : connectés → tableau de bord ; sinon → connexion (compte requis pour acheter).
 */
export default function Home() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    logger.log('Page /: redirection selon état auth', { hasUser: !!user })
    if (user) {
      logger.info('Page /: utilisateur connecté → /dashboard')
      router.push('/dashboard')
    } else {
      const redirectTo = encodeURIComponent('/dashboard')
      logger.info('Page /: non connecté → /login')
      router.push(`/login?redirectTo=${redirectTo}`)
    }
  }, [user, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 bg-mesh-auth">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-primary-300" />
        <p className="text-sm font-medium text-primary-200/90">Redirection…</p>
      </div>
    </div>
  )
}
