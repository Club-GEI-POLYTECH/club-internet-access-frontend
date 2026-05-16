'use client'

import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Users, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/lib/notify'
import { paymentStatusLabel, toUserErrorMessage } from '@/lib/user-messages'
import type { CreateUserRequest, UpdateUserRequest, User, UserWithPayments } from '@/types/api'
import { UserRole } from '@/types/api'
import type { PaginationMeta } from '@/types/pagination'
import ListToolbar from '@/components/ListToolbar'
import PaginationBar from '@/components/PaginationBar'
import { filterUsers } from '@/lib/client-list-filter'
import { sortUsers } from '@/lib/client-list-sort'
import { format } from 'date-fns'

const roleLabel: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.AGENT]: 'Agent',
  [UserRole.STUDENT]: 'Étudiant',
}

const roleOptions: UserRole[] = [UserRole.STUDENT, UserRole.AGENT, UserRole.ADMIN]

const USER_SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date d’inscription' },
  { value: 'email', label: 'E-mail' },
  { value: 'lastName', label: 'Nom' },
  { value: 'firstName', label: 'Prénom' },
]

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [usersRaw, setUsersRaw] = useState<UserWithPayments[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [paymentsLimit, setPaymentsLimit] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
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
      const result = await apiClient.users.listPaginated({
        page,
        limit,
        paymentsLimit,
        role: roleFilter || undefined,
      })
      setUsersRaw(result.data)
      setMeta(result.meta)
    } catch (e: unknown) {
      notify.error(toUserErrorMessage(e, 'Liste indisponible'))
      setUsersRaw([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, paymentsLimit, roleFilter])

  const users = useMemo(() => {
    let list = usersRaw
    if (activeFilter === 'true') list = list.filter((u) => u.isActive)
    else if (activeFilter === 'false') list = list.filter((u) => !u.isActive)
    list = filterUsers(list, search)
    return sortUsers(list, sortBy, sortOrder)
  }, [usersRaw, activeFilter, search, sortBy, sortOrder])

  useEffect(() => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return
    void loadUsers()
  }, [loadUsers, currentUser])

  const applyFilters = () => {
    setSearch(searchDraft.trim())
  }

  const resetFilters = () => {
    setSearchDraft('')
    setSearch('')
    setRoleFilter('')
    setActiveFilter('')
    setSortBy('createdAt')
    setSortOrder('desc')
    setLimit(20)
    setPaymentsLimit(10)
    setPage(1)
  }

  const handleLimitChange = (next: number) => {
    setLimit(next)
    setPage(1)
  }

  const handleSortByChange = (value: string) => {
    setSortBy(value)
  }

  const toggleSortOrder = () => {
    setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
  }

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-900">
        <p className="font-medium">Accès réservé aux administrateurs.</p>
      </div>
    )
  }

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
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
      notify.error(toUserErrorMessage(err, 'Création impossible'))
    }
  }

  const handleUpdate = async (u: User, payload: UpdateUserRequest) => {
    try {
      await apiClient.users.update(u.id, payload)
      notify.success('Utilisateur mis à jour')
      setEditUser(null)
      void loadUsers()
    } catch (err: unknown) {
      notify.error(toUserErrorMessage(err, 'Mise à jour impossible'))
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
      notify.error(toUserErrorMessage(err, 'Suppression impossible'))
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
            Créez, modifiez ou supprimez les comptes utilisateurs de la plateforme.
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
        <ListToolbar
          searchValue={searchDraft}
          onSearchChange={setSearchDraft}
          searchPlaceholder="Nom, e-mail ou téléphone…"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={handleSortByChange}
          onSortOrderToggle={toggleSortOrder}
          sortOptions={USER_SORT_OPTIONS}
          limit={limit}
          onLimitChange={handleLimitChange}
          onApply={applyFilters}
          onReset={resetFilters}
          filters={
            <>
              <div className="flex min-w-[120px] flex-col">
                <label htmlFor="users-filter-role" className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Rôle
                </label>
                <select
                  id="users-filter-role"
                  className="input text-sm"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">Tous</option>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-[120px] flex-col">
                <label htmlFor="users-filter-active" className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Compte
                </label>
                <select
                  id="users-filter-active"
                  className="input text-sm"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as '' | 'true' | 'false')}
                >
                  <option value="">Tous</option>
                  <option value="true">Actifs</option>
                  <option value="false">Inactifs</option>
                </select>
              </div>
              <div className="flex min-w-[120px] flex-col">
                <label htmlFor="users-payments-limit" className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Paiements affichés
                </label>
                <select
                  id="users-payments-limit"
                  className="input text-sm"
                  value={paymentsLimit}
                  onChange={(e) => {
                    setPaymentsLimit(Number(e.target.value))
                    setPage(1)
                  }}
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} max.
                    </option>
                  ))}
                </select>
              </div>
            </>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-12 text-center text-ink-500">Aucun utilisateur ne correspond à vos critères.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-ink-200 bg-ink-50/80 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="w-8 px-2 py-3" aria-hidden />
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Paiements</th>
                  <th className="px-4 py-3">Actif</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => {
                  const paymentCount = u.paymentsTotal ?? u.payments?.length ?? 0
                  const expanded = expandedUserId === u.id
                  const hasPayments = (u.payments?.length ?? 0) > 0
                  return (
                    <Fragment key={u.id}>
                      <tr className="hover:bg-ink-50/60">
                        <td className="px-2 py-3">
                          {hasPayments ? (
                            <button
                              type="button"
                              className="rounded p-1 text-ink-500 hover:bg-ink-100"
                              onClick={() => setExpandedUserId(expanded ? null : u.id)}
                              aria-expanded={expanded ? 'true' : 'false'}
                              aria-label={expanded ? 'Masquer les paiements' : 'Afficher les paiements'}
                            >
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-medium text-ink-900">
                          {u.firstName} {u.lastName}
                        </td>
                        <td className="px-4 py-3 text-ink-700">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-800">
                            {roleLabel[u.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-600">
                          {paymentCount > 0 ? (
                            <span>
                              {paymentCount} paiement{paymentCount > 1 ? 's' : ''}
                              {(u.paymentsTotal ?? 0) > (u.payments?.length ?? 0) && u.payments?.length
                                ? ` (${u.payments.length} affichés)`
                                : null}
                            </span>
                          ) : (
                            '—'
                          )}
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
                      {expanded && hasPayments ? (
                        <tr className="bg-ink-50/40">
                          <td colSpan={7} className="px-4 py-3">
                            <ul className="space-y-2 text-xs">
                              {u.payments!.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-ink-100 bg-white px-3 py-2"
                                >
                                  <span className="font-semibold text-ink-900">{p.amount.toLocaleString('fr-FR')} CDF</span>
                                  <span className="text-ink-600">{paymentStatusLabel(p.status)}</span>
                                  <span className="text-ink-500">{format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                                  {p.transactionId ? (
                                    <span className="font-mono text-ink-500">Réf. {p.transactionId}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar meta={meta} onPageChange={setPage} loading={loading} />
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-dialog-title"
          onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-200 bg-white p-6 shadow-xl">
            <h2 id="create-user-dialog-title" className="font-display text-lg font-bold text-ink-900">
              Nouvel utilisateur
            </h2>
            <form className="mt-4 space-y-3" onSubmit={(e) => void handleCreate(e)}>
              <div>
                <label htmlFor="create-user-email" className="mb-1 block text-xs font-semibold text-ink-500">
                  E-mail *
                </label>
                <input
                  id="create-user-email"
                  className="input"
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  autoComplete="email"
                  title="Adresse e-mail du nouvel utilisateur"
                  placeholder="vous@exemple.cd"
                />
              </div>
              <div>
                <label htmlFor="create-user-password" className="mb-1 block text-xs font-semibold text-ink-500">
                  Mot de passe *
                </label>
                <input
                  id="create-user-password"
                  className="input"
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  autoComplete="new-password"
                  title="Mot de passe du nouvel utilisateur"
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="create-user-firstname" className="mb-1 block text-xs font-semibold text-ink-500">
                    Prénom *
                  </label>
                  <input
                    id="create-user-firstname"
                    className="input"
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    autoComplete="given-name"
                    title="Prénom"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label htmlFor="create-user-lastname" className="mb-1 block text-xs font-semibold text-ink-500">
                    Nom *
                  </label>
                  <input
                    id="create-user-lastname"
                    className="input"
                    required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    autoComplete="family-name"
                    title="Nom"
                    placeholder="Dupont"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="create-user-role" className="mb-1 block text-xs font-semibold text-ink-500">
                  Rôle *
                </label>
                <select
                  id="create-user-role"
                  className="input"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                  title="Rôle du nouvel utilisateur"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="create-user-phone" className="mb-1 block text-xs font-semibold text-ink-500">
                  Téléphone
                </label>
                <input
                  id="create-user-phone"
                  className="input"
                  type="tel"
                  value={createForm.phone ?? ''}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  autoComplete="tel"
                  title="Numéro de téléphone (optionnel)"
                  placeholder="+243…"
                />
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
        <EditUserModal
          key={editUser.id}
          user={editUser}
          onClose={() => setEditUser(null)}
          onSubmit={(payload) => void handleUpdate(editUser, payload)}
        />
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

  const fieldId = (suffix: string) => `edit-user-${user.id}-${suffix}`
  const titleId = fieldId('dialog-title')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-200 bg-white p-6 shadow-xl">
        <h2 id={titleId} className="font-display text-lg font-bold text-ink-900">
          Modifier {user.email}
        </h2>
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
              <label htmlFor={fieldId('firstname')} className="mb-1 block text-xs font-semibold text-ink-500">
                Prénom
              </label>
              <input
                id={fieldId('firstname')}
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                title="Prénom"
                placeholder="Prénom"
              />
            </div>
            <div>
              <label htmlFor={fieldId('lastname')} className="mb-1 block text-xs font-semibold text-ink-500">
                Nom
              </label>
              <input
                id={fieldId('lastname')}
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                title="Nom"
                placeholder="Nom"
              />
            </div>
          </div>
          <div>
            <label htmlFor={fieldId('phone')} className="mb-1 block text-xs font-semibold text-ink-500">
              Téléphone
            </label>
            <input
              id={fieldId('phone')}
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              title="Téléphone"
              placeholder="+243…"
            />
          </div>
          <div>
            <label htmlFor={fieldId('role')} className="mb-1 block text-xs font-semibold text-ink-500">
              Rôle
            </label>
            <select
              id={fieldId('role')}
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              title="Rôle de l’utilisateur"
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </select>
          </div>
          <label htmlFor={fieldId('active')} className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
            <input
              id={fieldId('active')}
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-ink-300"
              title="Compte actif ou désactivé"
            />
            Compte actif
          </label>
          <div>
            <label htmlFor={fieldId('password')} className="mb-1 block text-xs font-semibold text-ink-500">
              Nouveau mot de passe (optionnel)
            </label>
            <input
              id={fieldId('password')}
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Laisser vide pour ne pas changer"
              autoComplete="new-password"
              title="Nouveau mot de passe (optionnel)"
            />
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
