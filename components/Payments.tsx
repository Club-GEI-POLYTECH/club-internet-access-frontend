'use client'

import { useEffect, useState } from 'react'
import { paymentsService } from '@/services/api'
import { apiClient } from '@/lib/api-client'
import { CheckCircle, XCircle, Clock, DollarSign, Ban, Loader2 } from 'lucide-react'
import { notify } from '@/lib/notify'
import { format } from 'date-fns'
import { PaymentMethod, type Payment } from '@/types/api'
import { isKelpayPaymentPendingOrProcessing } from '@/types/frontend-types'

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingPaymentId, setCancellingPaymentId] = useState<string | null>(null)
  const [completeModalPayment, setCompleteModalPayment] = useState<Payment | null>(null)
  const [completeTxnInput, setCompleteTxnInput] = useState('')
  const [completingPaymentId, setCompletingPaymentId] = useState<string | null>(null)

  useEffect(() => {
    void loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      const data = await paymentsService.getAll()
      setPayments(data)
    } catch (error: any) {
      notify.error('Impossible de charger les paiements', 'Vérifiez votre connexion ou réessayez dans un instant.')
    } finally {
      setLoading(false)
    }
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
        'Identifiant manquant',
        'Indiquez la référence reçue de l’opérateur ou de Kelpay (transaction / merchant).',
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
    } catch (error: any) {
      notify.error(
        'Complétion impossible',
        error.response?.data?.message || 'Le serveur n’a pas accepté la référence. Vérifiez et réessayez.',
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
        'Annuler ce paiement Mobile Money en attente ?\nLa réservation du ticket pourra être libérée côté serveur.'
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
          throw new Error('Annulation impossible : le serveur refuse et aucun ticket lié (ticketId).')
        }
      }
      notify.success('Demande annulée', 'Le paiement en attente a été annulé. La liste est à jour.')
      await loadPayments()
    } catch (error: unknown) {
      notify.error(
        'Annulation impossible',
        error instanceof Error ? error.message : 'Réessayez ou contactez le support si le blocage persiste.',
      )
    } finally {
      setCancellingPaymentId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
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
    return badges[status as keyof typeof badges] || (
      <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
        {status}
      </span>
    )
  }

  const getMethodLabel = (method: string) => {
    const methods = {
      mobile_money: 'Mobile Money',
      cash: 'Espèces',
      card: 'Carte',
    }
    return methods[method as keyof typeof methods] || method
  }

  const totalRevenue = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-ink-100 bg-gradient-to-br from-white to-primary-50/30 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Historique</p>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-ink-900">Paiements</h1>
        <p className="mt-2 text-ink-600">
          Revenus cumulés (paiements complétés) :{' '}
          <span className="font-semibold text-emerald-700">{totalRevenue.toLocaleString('fr-FR')} CDF</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">
          Cette page liste uniquement les transactions issues du parcours d&apos;achat (forfait + Mobile Money / KELPAY).
          Aucun paiement ne s&apos;ajoute manuellement ici.
        </p>
      </div>

      {/* Compléter un paiement en attente — transactionId obligatoire pour le backend */}
      {completeModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl shadow-ink-950/20 sm:p-8">
            <h2 className="font-display text-xl font-bold text-ink-900">Compléter le paiement</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Montant :{' '}
              <span className="font-semibold text-ink-900">{completeModalPayment.amount.toLocaleString('fr-FR')} CDF</span>
              . Saisissez la référence attendue par le serveur (<strong>transactionId</strong>).
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
                  className="input font-mono text-sm"
                  placeholder="Référence opérateur ou Kelpay"
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  Prérempli si l&apos;API a déjà renvoyé <span className="font-mono">transactionId</span> ou{' '}
                  <span className="font-mono">merchantReference</span>.
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
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={completingPaymentId !== null}
                >
                  {completingPaymentId ? 'Envoi…' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100">
            <thead className="bg-ink-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Montant
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
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-600">
                    {getMethodLabel(payment.method)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {getStatusBadge(payment.status)}
                  </td>
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
                          title="Annuler la demande KELPAY (paiement encore en attente)"
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

        {payments.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <DollarSign className="h-7 w-7" strokeWidth={2} />
            </div>
            <p className="mt-4 font-display text-lg font-semibold text-ink-900">Aucun paiement pour l’instant</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
              Après un achat de ticket, vos demandes Mobile Money apparaîtront ici pour suivi ou complétion si besoin.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

