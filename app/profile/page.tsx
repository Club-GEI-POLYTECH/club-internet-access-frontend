'use client'

import PrivateRoute from '@/components/PrivateRoute'
import Layout from '@/components/Layout'
import UserProfilePanel from '@/components/UserProfilePanel'

export default function ProfilePage() {
  return (
    <PrivateRoute>
      <Layout>
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Compte</p>
            <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-ink-900">Mon profil</h1>
            <p className="mt-2 text-sm text-ink-600">
              Consultez et modifiez vos informations. L’e-mail n’est pas modifiable ici.
            </p>
          </div>
          <UserProfilePanel />
        </div>
      </Layout>
    </PrivateRoute>
  )
}
