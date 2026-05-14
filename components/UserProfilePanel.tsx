'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { User as UserIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/lib/notify'
import { UserRole } from '@/types/api'

const roleLabel: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrateur',
  [UserRole.AGENT]: 'Agent',
  [UserRole.STUDENT]: 'Étudiant',
}

export default function UserProfilePanel() {
  const { user, refreshUser } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName)
    setLastName(user.lastName)
    setPhone(user.phone ?? '')
  }, [user])

  if (!user) return null

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiClient.users.update(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      })
      await refreshUser()
      notify.success('Profil mis à jour', 'Vos informations ont été enregistrées.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de mettre à jour le profil.'
      notify.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card border-primary-100/80 bg-gradient-to-br from-white to-primary-50/30">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
          <UserIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">Informations du compte</h2>
          <p className="text-sm text-ink-600">
            {user.email} · <span className="font-medium text-primary-700">{roleLabel[user.role]}</span>
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="profile-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            E-mail
          </label>
          <input
            id="profile-email"
            type="email"
            value={user.email}
            disabled
            aria-label="Adresse e-mail (non modifiable)"
            aria-describedby="profile-email-hint"
            title="Adresse e-mail (non modifiable)"
            placeholder="Non modifiable"
            className="input cursor-not-allowed bg-ink-50 text-ink-600"
          />
          <p id="profile-email-hint" className="mt-1 text-xs text-ink-500">
            L’e-mail n’est pas modifiable ici. Contactez un administrateur si besoin.
          </p>
        </div>
        <div>
          <label htmlFor="profile-first" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            Prénom
          </label>
          <input
            id="profile-first"
            className="input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            aria-label="Prénom"
            title="Prénom"
            placeholder="Jean"
          />
        </div>
        <div>
          <label htmlFor="profile-last" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            Nom
          </label>
          <input
            id="profile-last"
            className="input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            aria-label="Nom"
            title="Nom"
            placeholder="Dupont"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="profile-phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            Téléphone
          </label>
          <input
            id="profile-phone"
            type="tel"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+243…"
            autoComplete="tel"
            aria-label="Téléphone"
            title="Numéro de téléphone"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </div>
  )
}
