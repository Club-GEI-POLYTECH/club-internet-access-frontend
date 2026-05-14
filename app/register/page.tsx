'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Sparkles, Mail } from 'lucide-react'
import { notify } from '@/lib/notify'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/lib/logger'
import { isSixDigitVerificationCode, isValidRegistrationEmail } from '@/lib/register-email'

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { applyAuthResponse } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [emailVerificationCode, setEmailVerificationCode] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const redirectTo = searchParams.get('redirectTo')

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [resendCooldown])

  const resetVerificationState = () => {
    if (codeSent) {
      setCodeSent(false)
      setEmailVerificationCode('')
      setResendCooldown(0)
    }
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    setCodeSent(false)
    setEmailVerificationCode('')
    setResendCooldown(0)
  }

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!isValidRegistrationEmail(trimmed)) {
      notify.error('Adresse e-mail invalide')
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      notify.error('Renseignez le prénom et le nom avant d’envoyer le code')
      return
    }
    if (password.length < 6) {
      notify.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    if (password !== confirmPassword) {
      notify.error('Les mots de passe ne correspondent pas')
      return
    }

    setSendingCode(true)
    logger.log('Register: demande code e-mail', { email: trimmed, firstSend: !codeSent })
    try {
      if (!codeSent) {
        await apiClient.auth.registerRequest({
          email: trimmed,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        })
      } else {
        await apiClient.auth.registerResend(trimmed)
      }
      setEmail(trimmed)
      setCodeSent(true)
      setResendCooldown(60)
      notify.success(
        'Code à 6 chiffres envoyé',
        'Vérifiez votre boîte de réception et le dossier courrier indésirable.',
      )
      logger.info('Register: code e-mail demandé ou renvoyé', { email: trimmed })
    } catch (error: unknown) {
      logger.error('Register: échec envoi code', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible d’envoyer le code. Vérifiez que le backend expose POST /auth/register/request (ou /resend).'
      notify.error(message)
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedEmail = email.trim().toLowerCase()
    if (!isValidRegistrationEmail(trimmedEmail)) {
      notify.error('Adresse e-mail invalide')
      return
    }
    if (!isSixDigitVerificationCode(emailVerificationCode)) {
      notify.error('Entrez le code à 6 chiffres reçu par e-mail')
      return
    }
    if (!codeSent) {
      notify.error('Demandez d’abord un code de vérification pour cet e-mail')
      return
    }

    setLoading(true)
    logger.log('Register: vérification du code (register/verify)', { email: trimmedEmail })

    try {
      const loginResponse = await apiClient.auth.registerVerify({
        email: trimmedEmail,
        code: emailVerificationCode.trim(),
      })
      applyAuthResponse(loginResponse)
      notify.success('Compte créé', 'Bienvenue !')
      logger.info('Register: inscription finalisée', { email: trimmedEmail })

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
      notify.error(message || 'Erreur lors de la validation du code ou de la création du compte')
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
              <p className="mt-2 text-sm text-ink-500">
                <span className="font-semibold text-ink-700">Étape 1 :</span> remplissez le formulaire et cliquez sur{' '}
                <span className="font-medium">Envoyer le code</span>.{' '}
                <span className="font-semibold text-ink-700">Étape 2 :</span> saisissez le code reçu, puis{' '}
                <span className="font-medium">Valider le code et créer mon compte</span>.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative mt-8 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Prénom *
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value)
                      resetVerificationState()
                    }}
                    className="input"
                    placeholder="Jean"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Nom *
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value)
                      resetVerificationState()
                    }}
                    className="input"
                    placeholder="Kabasele"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Téléphone <span className="font-normal normal-case text-ink-400">(optionnel)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    resetVerificationState()
                  }}
                  className="input"
                  placeholder="+243900000000"
                  autoComplete="tel"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Mot de passe *
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      resetVerificationState()
                    }}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Confirmation *
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      resetVerificationState()
                    }}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  E-mail *
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="input sm:flex-1"
                    placeholder="vous@unikin.cd"
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendCode()}
                    disabled={
                      sendingCode ||
                      resendCooldown > 0 ||
                      !isValidRegistrationEmail(email.trim()) ||
                      !firstName.trim() ||
                      !lastName.trim() ||
                      password.length < 6 ||
                      password !== confirmPassword
                    }
                    className="btn btn-primary shrink-0 whitespace-nowrap px-4 py-2.5 text-sm shadow-glow-sm disabled:opacity-50"
                    aria-label={
                      codeSent
                        ? 'Renvoyer le code de vérification par e-mail'
                        : 'Étape 1 — envoyer un code de vérification à 6 chiffres par e-mail'
                    }
                  >
                    {sendingCode ? (
                      'Envoi…'
                    ) : resendCooldown > 0 ? (
                      `Renvoyer (${resendCooldown}s)`
                    ) : codeSent ? (
                      'Renvoyer le code'
                    ) : (
                      <>
                        <Mail className="mr-1.5 inline h-4 w-4" />
                        Envoyer le code
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-ink-500">
                  Ce bouton n’est actif que lorsque prénom, nom, e-mail et mot de passe (identiques ×2) sont valides. Il
                  appelle l’API d’inscription <span className="font-medium">request</span> (puis <span className="font-medium">resend</span> si vous renvoyez le code).
                </p>
              </div>

              <div>
                <label htmlFor="email-code" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Code e-mail (6 chiffres) *
                </label>
                <input
                  id="email-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required={codeSent}
                  disabled={!codeSent}
                  value={emailVerificationCode}
                  onChange={(e) => setEmailVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input font-mono tracking-[0.35em] disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400"
                  placeholder={codeSent ? '000000' : '— envoyez le code d’abord —'}
                  title={codeSent ? undefined : 'Utilisez « Envoyer le code » après avoir rempli le formulaire'}
                />
                {!codeSent ? (
                  <p className="mt-1.5 text-xs text-ink-500">Ce champ s’active après l’étape « Envoyer le code ».</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !codeSent ||
                  !isSixDigitVerificationCode(emailVerificationCode)
                }
                className="btn btn-primary mt-2 w-full py-3.5 disabled:pointer-events-none disabled:opacity-50"
                title={
                  !codeSent
                    ? 'Envoyez d’abord le code sur votre e-mail'
                    : !isSixDigitVerificationCode(emailVerificationCode)
                      ? 'Saisissez les 6 chiffres reçus par e-mail'
                      : undefined
                }
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Validation…
                  </span>
                ) : (
                  'Étape 2 — Valider le code et créer mon compte'
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
