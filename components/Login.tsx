'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/lib/logger'
import { notify } from '@/lib/notify'
import { getSafeInternalRedirect } from '@/lib/safe-redirect'
import { AUTH_DASHBOARD_PATH, postAuthRedirectPath } from '@/lib/auth-routes'
import { getLoginErrorToast, isAuthRateLimitError } from '@/lib/auth-flow-errors'
import { Wifi, Sparkles, ArrowRight } from 'lucide-react'

const RATE_LIMIT_COOLDOWN_SEC = 60

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const { login, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const safeRedirectTarget = getSafeInternalRedirect(redirectTo)

  useEffect(() => {
    if (cooldownSec <= 0) return
    const id = window.setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldownSec])

  useEffect(() => {
    if (!user) return

    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'http:' &&
      process.env.NODE_ENV === 'production'
    ) {
      logger.info('Login: utilisateur déjà connecté en HTTP, redirection HTTPS')
      const httpsUrl = window.location.href
        .replace('http://', 'https://')
        .replace('/login', AUTH_DASHBOARD_PATH)
      window.location.href = httpsUrl
      return
    }

    logger.info('Login: session active, redirection tableau de bord')
    router.replace(postAuthRedirectPath())
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    logger.log('Login: soumission du formulaire', { email })
    setLoading(true)

    try {
      setFormError(null)
      await login(email, password)
      notify.success('Bienvenue !', 'Vous êtes connecté·e.')
      logger.info('Login: connexion réussie, redirection')

      if (
        typeof window !== 'undefined' &&
        window.location.protocol === 'http:' &&
        process.env.NODE_ENV === 'production'
      ) {
        const httpsUrl = window.location.href.replace('http://', 'https://')
        window.location.href = httpsUrl.replace('/login', AUTH_DASHBOARD_PATH)
      } else {
        router.push(postAuthRedirectPath())
      }
    } catch (error: unknown) {
      logger.error('Login: échec connexion', error)
      const { title, body } = getLoginErrorToast(error)
      setFormError(body)
      notify.error(title, body, { duration: 12_000 })
      if (isAuthRateLimitError(error)) {
        setCooldownSec(RATE_LIMIT_COOLDOWN_SEC)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-90" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        {/* Panneau marque */}
        <div className="relative flex flex-1 flex-col justify-center px-8 py-12 lg:px-14 lg:py-16">
          <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-200 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-primary-300" />
            Espace sécurisé
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-[2.75rem] lg:leading-[1.1]">
            Connexion Wi‑Fi
            <span className="mt-2 block bg-gradient-to-r from-primary-200 via-white to-indigo-200 bg-clip-text text-transparent">
              simple &amp; rapide
            </span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-primary-100/90">
            Accédez à la vente de tickets, à vos achats et à votre tableau de bord. Un compte est nécessaire pour
            acheter un forfait.
          </p>
          <div className="mt-10 hidden items-center gap-6 text-sm text-primary-200/80 lg:flex">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              Service UNIKIN
            </div>
            <div className="h-4 w-px bg-white/15" />
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary-400" />
              Forfaits 24h · 7j · 30j
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-1 items-center justify-center px-4 pb-16 pt-4 sm:px-8 lg:px-10 lg:pb-0 lg:pt-0">
          <div className="w-full max-w-md animate-scale-in">
            <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl shadow-ink-950/25 backdrop-blur-xl sm:p-10">
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary-400/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl" />

              <div className="relative text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow">
                  <Wifi className="h-8 w-8" strokeWidth={2} />
                </div>
                <h2 className="font-display text-2xl font-bold text-ink-900">Bon retour</h2>
                <p className="mt-2 text-sm text-ink-500">Université de Kinshasa — Club Internet Access</p>
              </div>

              <form onSubmit={handleSubmit} className="relative mt-8 space-y-5">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setFormError(null)
                    }}
                    className="input"
                    placeholder="vous@unikin.cd"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500"
                  >
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setFormError(null)
                    }}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                {formError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200/90 bg-red-50 px-3 py-2.5 text-center text-sm font-medium text-red-900"
                  >
                    {formError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading || cooldownSec > 0}
                  className="btn btn-primary group mt-2 w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Connexion…
                    </span>
                  ) : cooldownSec > 0 ? (
                    `Patientez ${cooldownSec}s…`
                  ) : (
                    <>
                      Se connecter
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>

              <div className="relative mt-8 text-center">
                <Link href="/forgot-password" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
                  Mot de passe oublié ?
                </Link>
              </div>

              <p className="relative mt-6 text-center text-sm text-ink-500">
                Pas encore de compte ?{' '}
                <Link
                  href={
                    safeRedirectTarget
                      ? `/register?redirectTo=${encodeURIComponent(safeRedirectTarget)}`
                      : '/register'
                  }
                  className="font-semibold text-primary-600 hover:text-primary-800"
                >
                  Créer un compte
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
