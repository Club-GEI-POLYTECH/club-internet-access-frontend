'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authService } from '@/services/api'
import { notify } from '@/lib/notify'
import { Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await authService.forgotPassword(email)
      setSent(true)
      notify.success('Code envoyé', 'Consultez votre boîte e-mail (et les indésirables).')
    } catch (error: any) {
      // On affiche toujours un message de succès pour des raisons de sécurité
      setSent(true)
      notify.success('Si cette adresse existe', 'Un lien de réinitialisation vient d’y être envoyé.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <Mail className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-ink-900 mb-2">
              Mot de passe oublié?
            </h1>
            <p className="text-ink-600">
              {sent
                ? 'Vérifiez votre boîte de réception'
                : 'Entrez votre email pour recevoir un lien de réinitialisation'}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-2">
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="votre.email@unikin.cd"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-900">
                  Si un compte existe avec cette adresse email, vous recevrez un email contenant
                  un lien pour réinitialiser votre mot de passe.
                </p>
                <p className="mt-2 text-sm text-emerald-900">
                  <strong>Le lien est valide pendant 1 heure.</strong>
                </p>
              </div>

              <div className="text-center text-sm text-ink-600">
                <p>Vous n'avez pas reçu l'email?</p>
                <button
                  onClick={() => setSent(false)}
                  className="text-primary-600 hover:text-primary-700 font-medium mt-2"
                >
                  Réessayer
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

