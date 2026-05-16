'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { paymentsService } from '@/services/api'
import { apiClient } from '@/lib/api-client'
import { CheckCircle, XCircle, Clock, DollarSign, Ban, Loader2, RefreshCw } from 'lucide-react'
import { notify } from '@/lib/notify'
import { format } from 'date-fns'
import { PaymentMethod, type Payment } from '@/types/api'
import { isKelpayPaymentPendingOrProcessing } from '@/types/frontend-types'
import { paymentStatusLabel, toUserErrorMessage } from '@/lib/user-messages'
import type { PaginationMeta } from '@/types/pagination'
import ListToolbar from '@/components/ListToolbar'
import PaginationBar from '@/components/PaginationBar'
import { filterPayments } from '@/lib/client-list-filter'
import { extractTicketUsernameFromNotes } from '@/lib/normalize-payment-list'
import { sortPayments } from '@/lib/client-list-sort'

const PAYMENT_SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date' },
  { value: 'amount', label: 'Montant' },
  { value: 'status', label: 'Statut' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'processing', label: 'En cours' },
  { value: 'success', label: 'Réussi' },
  { value: 'completed', label: 'Complété' },
  { value: 'failed', label: 'Échoué' },
  { value: 'cancelled', label: 'Annulé' },
]

function isSuccessfulPayment(status: string) {
  return status === 'completed' || status === 'success'
}

export default function Payments() {
  const [paymentsRaw, setPaymentsRaw] = useState<Payment[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [cancellingPaymentId, setCancellingPaymentId] = useState<string | null>(null)
  const [completeModalPayment, setCompleteModalPayment] = useState<Payment | null>(null)
  const [completeTxnInput, setCompleteTxnInput] = useState('')
  const [completingPaymentId, setCompletingPaymentId] = useState<string | null>(null)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiClient.payments.listPaginated({
        page,
        limit,
        status: statusFilter || undefined,
        method: methodFilter || undefined,
      })
      setPaymentsRaw(result.data)
      setMeta(result.meta)
    } catch {
      notify.error('Impossible de charger les paiements', 'Vérifiez votre connexion ou réessayez dans un instant.')
      setPaymentsRaw([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, statusFilter, methodFilter])

  const payments = useMemo(() => {
    const filtered = filterPayments(paymentsRaw, search)
    return sortPayments(filtered, sortBy, sortOrder)
  }, [paymentsRaw, search, sortBy, sortOrder])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  const applyFilters = () => {
    setSearch(searchDraft.trim())
  }

  const resetFilters = () => {
    setSearchDraft('')
    setSearch('')
    setStatusFilter('')
    setMethodFilter('')
    setSortBy('createdAt')
    setSortOrder('desc')
    setLimit(20)
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

  const openCompleteModal = (p: Payment) => {
    setCompleteModalPayment(p)
    setCompleteTxnInput((p.transactionId || p.merchantReference || '').trim())
  }

  const submitCompletePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completeModalPayment) return
    const tid = completeTxnInput.trim()
    if (!tid) {
      notify.error(
        'Référence manquante',
        'Indiquez la référence de transaction reçue sur votre téléphone ou de votre opérateur Mobile Money.',
      )
      return
    }
    setCompletingPaymentId(completeModalPayment.id)
    try {
      await paymentsService.complete(completeModalPayment.id, tid)
      notify.success('Paiement complété', 'Le statut a été mis à jour. La liste se rafraîchit.')
      setCompleteModalPayment(null)
      setCompleteTxnInput('')
      await loadPayments()
    } catch (error: unknown) {
      notify.error(
        'Complétion impossible',
        toUserErrorMessage(error, 'Cette référence n’a pas été reconnue. Vérifiez-la et réessayez.'),
      )
    } finally {
      setCompletingPaymentId(null)
    }
  }

  const canCancelKelpayFromList = (p: Payment) => {
    if (p.method !== PaymentMethod.MOBILE_MONEY) return false
    return isKelpayPaymentPendingOrProcessing(String(p.status))
  }

  const handleCancelKelpayPayment = async (p: Payment) => {
    if (!canCancelKelpayFromList(p)) return
    if (
      !window.confirm(
        'Annuler ce paiement Mobile Money en attente ?\nLe forfait réservé pourra redevenir disponible pour d’autres acheteurs.',
      )
    ) {
      return
    }
    setCancellingPaymentId(p.id)
    try {
      try {
        await apiClient.payments.cancelKelpay(p.id)
      } catch {
        if (p.ticketId) {
          await apiClient.tickets.release(p.ticketId)
        } else {
          throw new Error('Annulation impossible. Aucun forfait n’est associé à ce paiement.')
        }
      }
      notify.success('Demande annulée', 'Le paiement en attente a été annulé. La liste est à jour.')
      await loadPayments()
    } catch (error: unknown) {
      notify.error(
        'Annulation impossible',
        toUserErrorMessage(error, 'Réessayez ou contactez le support si le blocage persiste.'),
      )
    } finally {
      setCancellingPaymentId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, ReactNode> = {
      pending: (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
          <Clock className="mr-1 h-3 w-3" />
          En attente
        </span>
      ),
      processing: (
        <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-900">
          <Clock className="mr-1 h-3 w-3" />
          En cours
        </span>
      ),
      success: (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
          <CheckCircle className="mr-1 h-3 w-3" />
          Réussi
        </span>
      ),
      completed: (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
          <CheckCircle className="mr-1 h-3 w-3" />
          Complété
        </span>
      ),
      failed: (
        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-900">
          <XCircle className="mr-1 h-3 w-3" />
          Échoué
        </span>
      ),
      cancelled: (
        <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
          <XCircle className="mr-1 h-3 w-3" />
          Annulé
        </span>
      ),
    }
    return (
      badges[status] ?? (
        <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
          {paymentStatusLabel(status)}
        </span>
      )
    )
  }

  const getMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      mobile_money: 'Mobile Money',
      card: 'Carte',
    }
    if (method === 'cash') return 'Espèces (historique)'
    return methods[method] ?? method
  }

  const pageRevenue = payments.filter((p) => isSuccessfulPayment(String(p.status))).reduce((sum, p) => sum + p.amount, 0)

  if (loading && paymentsRaw.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="rounded-2xl border border-ink-100 bg-gradient-to-br from-white to-primary-50/30 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Historique</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-ink-900">Paiements</h1>
          <p className="mt-2 text-ink-600">
            {meta ? (
              <>
                <span className="font-semibold text-ink-900">{meta.total}</span> paiement{meta.total > 1 ? 's' : ''} au
                total
              </>
            ) : (
              'Chargement…'
            )}
            {payments.length > 0 ? (
              <>
                {' '}
                · Revenus sur cette page (réussis) :{' '}
                <span className="font-semibold text-emerald-700">{pageRevenue.toLocaleString('fr-FR')} CDF</span>
              </>
            ) : null}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">
            Transactions issues du parcours d&apos;achat (forfait + Mobile Money). Utilisez les filtres et la pagination
            pour parcourir l&apos;historique.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadPayments()}
          className="btn btn-secondary inline-flex shrink-0 items-center gap-2 self-start"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {completeModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl shadow-ink-950/20 sm:p-8">
            <h2 className="font-display text-xl font-bold text-ink-900">Compléter le paiement</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Montant :{' '}
              <span className="font-semibold text-ink-900">{completeModalPayment.amount.toLocaleString('fr-FR')} CDF</span>
              . Saisissez la référence de transaction indiquée par votre opérateur ou sur votre téléphone.
            </p>
            <form onSubmit={submitCompletePayment} className="mt-6 space-y-4">
              <div>
                <label htmlFor="payments-complete-txn" className="mb-2 block text-sm font-medium text-ink-800">
                  Identifiant de transaction *
                </label>
                <input
                  id="payments-complete-txn"
                  type="text"
                  required
                  value={completeTxnInput}
                  onChange={(e) => setCompleteTxnInput(e.target.value)}
                  className="input text-sm"
                  placeholder="Référence reçue après le paiement"
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  Ce champ peut être prérempli si nous avons déjà reçu la référence de votre paiement.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompleteModalPayment(null)
                    setCompleteTxnInput('')
                  }}
                  className="btn btn-secondary flex-1"
                  disabled={completingPaymentId !== null}
                >
                  Fermer
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={completingPaymentId !== null}>
                  {completingPaymentId ? 'Envoi…' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <ListToolbar
          searchValue={searchDraft}
          onSearchChange={setSearchDraft}
          searchPlaceholder="Référence, e-mail, forfait…"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={handleSortByChange}
          onSortOrderToggle={toggleSortOrder}
          sortOptions={PAYMENT_SORT_OPTIONS}
          limit={limit}
          onLimitChange={handleLimitChange}
          onApply={applyFilters}
          onReset={resetFilters}
          filters={
            <>
              <div className="flex min-w-[140px] flex-col">
                <label htmlFor="payments-filter-status" className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Statut
                </label>
                <select
                  id="payments-filter-status"
                  className="input text-sm"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  {STATUS_FILTER_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-[140px] flex-col">
                <label htmlFor="payments-filter-method" className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Méthode
                </label>
                <select
                  id="payments-filter-method"
                  className="input text-sm"
                  value={methodFilter}
                  onChange={(e) => {
                    setMethodFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">Toutes</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="card">Carte</option>
                </select>
              </div>
            </>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <DollarSign className="h-7 w-7" strokeWidth={2} />
            </div>
            <p className="mt-4 font-display text-lg font-semibold text-ink-900">Aucun paiement trouvé</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
              Aucun résultat pour ces critères. Modifiez les filtres ou réinitialisez la recherche.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100">
              <thead className="bg-ink-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Forfait
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Méthode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-primary-50/30">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center">
                        <DollarSign className="mr-2 h-4 w-4 text-emerald-600" />
                        <span className="font-semibold text-ink-900">{payment.amount.toLocaleString('fr-FR')} CDF</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-600">
                      {payment.createdBy ? (
                        <div>
                          <p className="font-medium text-ink-900">
                            {payment.createdBy.firstName} {payment.createdBy.lastName}
                          </p>
                          <p className="text-xs text-ink-500">{payment.createdBy.email}</p>
                        </div>
                      ) : payment.phoneNumber ? (
                        <p className="text-ink-700">{payment.phoneNumber}</p>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-600">
                      {payment.ticket?.username ? (
                        <div>
                          <span className="font-mono text-ink-800">{payment.ticket.username}</span>
                          {payment.ticket.profile ? (
                            <p className="mt-0.5 text-xs text-ink-500">{payment.ticket.profile}</p>
                          ) : null}
                        </div>
                      ) : extractTicketUsernameFromNotes(payment.notes) ? (
                        <span className="font-mono text-ink-800">{extractTicketUsernameFromNotes(payment.notes)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-600">
                      {getMethodLabel(payment.method)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">{getStatusBadge(String(payment.status))}</td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-ink-600">
                      {payment.transactionId || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-600">
                      {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {payment.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => openCompleteModal(payment)}
                            className="rounded-lg px-2 py-1 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900"
                          >
                            Compléter
                          </button>
                        )}
                        {canCancelKelpayFromList(payment) && (
                          <button
                            type="button"
                            onClick={() => void handleCancelKelpayPayment(payment)}
                            disabled={cancellingPaymentId === payment.id}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-700 transition-colors hover:bg-rose-50 hover:text-rose-900 disabled:opacity-50"
                            title="Annuler le paiement Mobile Money en attente"
                          >
                            {cancellingPaymentId === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                            Annuler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar meta={meta} onPageChange={setPage} loading={loading} />
      </div>
    </div>
  )
}
