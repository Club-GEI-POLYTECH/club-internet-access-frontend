'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, Users, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/lib/notify'
import type { CreateUserRequest, UpdateUserRequest, User } from '@/types/api'
import { UserRole } from '@/types/api'

const roleLabel: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.AGENT]: 'Agent',
  [UserRole.STUDENT]: 'Étudiant',
}

const roleOptions: UserRole[] = [UserRole.STUDENT, UserRole.AGENT, UserRole.ADMIN]

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: UserRole.STUDENT,
    phone: '',
  })

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const list = await apiClient.users.list()
      setUsers(Array.isArray(list) ? list : [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Liste indisponible'
      notify.error(msg)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-900">
        <p className="font-medium">Accès réservé aux administrateurs.</p>
      </div>
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.users.create({
        ...createForm,
        email: createForm.email.trim().toLowerCase(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        phone: createForm.phone?.trim() || undefined,
      })
      notify.success('Utilisateur créé')
      setCreateOpen(false)
      setCreateForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: UserRole.STUDENT,
        phone: '',
      })
      void loadUsers()
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Création impossible')
    }
  }

  const handleUpdate = async (u: User, payload: UpdateUserRequest) => {
    try {
      await apiClient.users.update(u.id, payload)
      notify.success('Utilisateur mis à jour')
      setEditUser(null)
      void loadUsers()
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Mise à jour impossible')
    }
  }

  const handleDelete = async (u: User) => {
    if (u.id === currentUser.id) {
      notify.error('Vous ne pouvez pas supprimer votre propre compte depuis cette interface.')
      return
    }
    if (!window.confirm(`Supprimer définitivement ${u.email} ?`)) return
    try {
      await apiClient.users.delete(u.id)
      notify.success('Utilisateur supprimé')
      void loadUsers()
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Administration</p>
          <h1 className="font-display mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight text-ink-900">
            <Users className="h-8 w-8 text-primary-600" />
            Utilisateurs
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Liste, création, modification et suppression via l’API <code className="rounded bg-ink-100 px-1 text-xs">/users</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadUsers()} className="btn btn-secondary inline-flex items-center gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Créer un utilisateur
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-12 text-center text-ink-500">Aucun utilisateur retourné par l’API.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-ink-200 bg-ink-50/80 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Actif</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-800">
                        {roleLabel[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{u.isActive ? 'Oui' : 'Non'}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="btn btn-sm btn-secondary mr-2 inline-flex items-center gap-1" onClick={() => setEditUser(u)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm inline-flex items-center gap-1 border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                        onClick={() => void handleDelete(u)}
                        disabled={u.id === currentUser.id}
                        title={u.id === currentUser.id ? 'Impossible de supprimer votre compte' : undefined}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-200 bg-white p-6 shadow-xl">
            <h2 className="font-display text-lg font-bold text-ink-900">Nouvel utilisateur</h2>
            <form className="mt-4 space-y-3" onSubmit={(e) => void handleCreate(e)}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">E-mail *</label>
                <input className="input" type="email" required value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Mot de passe *</label>
                <input className="input" type="password" required value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-500">Prénom *</label>
                  <input className="input" required value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-500">Nom *</label>
                  <input className="input" required value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Rôle *</label>
                <select className="input" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Téléphone</label>
                <input className="input" value={createForm.phone ?? ''} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editUser ? (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSubmit={(payload) => void handleUpdate(editUser, payload)} />
      ) : null}
    </div>
  )
}

function EditUserModal({
  user,
  onClose,
  onSubmit,
}: {
  user: User
  onClose: () => void
  onSubmit: (payload: UpdateUserRequest) => void
}) {
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [role, setRole] = useState(user.role)
  const [isActive, setIsActive] = useState(user.isActive)
  const [newPassword, setNewPassword] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-200 bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-bold text-ink-900">Modifier {user.email}</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            const payload: UpdateUserRequest = {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: phone.trim(),
              role,
              isActive,
            }
            if (newPassword.trim().length >= 6) payload.password = newPassword.trim()
            onSubmit(payload)
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Prénom</label>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Nom</label>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Téléphone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Rôle</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-ink-300" />
            Compte actif
          </label>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Nouveau mot de passe (optionnel)</label>
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" autoComplete="new-password" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
