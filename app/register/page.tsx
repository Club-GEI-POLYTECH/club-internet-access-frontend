'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import type { RegisterRequest } from '@/types/api'
import { logger } from '@/lib/logger'

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectTo = searchParams.get('redirectTo')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    logger.log('Register: soumission du formulaire', { email })

    try {
      const payload: RegisterRequest = {
        email,
        password,
        firstName,
        lastName,
        phone: phone || undefined,
      }

      await apiClient.auth.register(payload)
      toast.success('Compte créé avec succès, connexion en cours...')
      logger.info('Register: compte créé, tentative de connexion', { email })

      await login(email, password)

      const target = redirectTo || '/dashboard'
      router.push(target)
    } catch (error: unknown) {
      logger.error('Register: échec inscription', error)
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : error instanceof Error
            ? error.message
            : undefined
      toast.error(message || 'Erreur lors de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-90" />
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="mb-8 text-center lg:hidden">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-200">
            <Sparkles className="h-3 w-3" />
            Nouveau compte
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Club Internet Access</h1>
        </div>

        <div className="w-full max-w-lg animate-scale-in">
          <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl shadow-ink-950/25 backdrop-blur-xl sm:p-10">
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-primary-400/20 blur-3xl" />

            <div className="relative text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow">
                <UserPlus className="h-8 w-8" strokeWidth={2} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Créer un compte</h2>
              <p className="mt-2 text-sm text-ink-500">Accédez à l&apos;achat de tickets et à votre espace personnel</p>
            </div>

            <form onSubmit={handleSubmit} className="relative mt-8 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Prénom
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input"
                    placeholder="Jean"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Nom
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input"
                    placeholder="Kabasele"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="vous@unikin.cd"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Téléphone <span className="font-normal normal-case text-ink-400">(optionnel)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="+243900000000"
                  autoComplete="tel"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
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
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Confirmation
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary mt-2 w-full py-3.5">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Création…
                  </span>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </form>

            <p className="relative mt-8 text-center text-sm text-ink-500">
              Déjà inscrit ?{' '}
              <Link
                href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'}
                className="font-semibold text-primary-600 hover:text-primary-800"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function RegisterPageFallback() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-90" />
      <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-primary-300" />
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  )
}
