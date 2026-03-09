'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/lib/logger'
import toast from 'react-hot-toast'
import { Wifi } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')

  // Vérifier si l'utilisateur est déjà authentifié
  useEffect(() => {
    if (user && typeof window !== 'undefined' && window.location.protocol === 'http:' && process.env.NODE_ENV === 'production') {
      logger.info('Login: utilisateur déjà connecté en HTTP, redirection HTTPS')
      const httpsUrl = window.location.href.replace('http://', 'https://').replace('/login', '/')
      window.location.href = httpsUrl
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    logger.log('Login: soumission du formulaire', { email })
    setLoading(true)

    try {
      await login(email, password)
      toast.success('Connexion réussie!')
      logger.info('Login: connexion réussie, redirection')

      if (typeof window !== 'undefined' && window.location.protocol === 'http:' && process.env.NODE_ENV === 'production') {
        const httpsUrl = window.location.href.replace('http://', 'https://')
        window.location.href = httpsUrl.replace('/login', '/')
      } else {
        router.push(redirectTo || '/')
      }
    } catch (error: any) {
      logger.error('Login: échec connexion', error)
      toast.error(error.response?.data?.message || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4">
      <div className="max-w-md w-full animate-scale-in">
        <div className="bg-white rounded-2xl shadow-xl p-8 transition-shadow duration-300 hover:shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4 transition-transform duration-300 hover:scale-110">
              <Wifi className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Club Internet Access
            </h1>
            <p className="text-gray-600">Université de Kinshasa - UNIKIN</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@unikin.cd"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Mot de passe oublié?
            </Link>
          </div>

          <div className="mt-4 text-center text-sm text-gray-500">
            <p>
              Pas encore de compte ?{' '}
              <Link
                href={redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : '/register'}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}