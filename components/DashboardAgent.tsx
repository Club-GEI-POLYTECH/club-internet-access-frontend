'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { ticketTypesPricePlaceholder } from '@/lib/ticket-type-price-placeholder'
import { DollarSign, ShoppingCart, CreditCard } from 'lucide-react'
import { notify } from '@/lib/notify'
import type { Payment, CreatePaymentRequest } from '@/types/api'
import { PaymentMethod as PaymentMethodEnum } from '@/types/api'
import { paymentMethodLabels } from '@/types/api'

export default function DashboardAgent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [amountPlaceholder, setAmountPlaceholder] = useState('')

  const [paymentData, setPaymentData] = useState<CreatePaymentRequest>({
    amount: 0,
    method: PaymentMethodEnum.MOBILE_MONEY,
    phoneNumber: '',
  })

  useEffect(() => {
    loadRecentData()
    apiClient.tickets
      .getTypes()
      .then((types) => setAmountPlaceholder(ticketTypesPricePlaceholder(types)))
      .catch(() => setAmountPlaceholder(''))
  }, [])

  const loadRecentData = async () => {
    try {
      const payments = await apiClient.payments.list().catch(() => [])
      setRecentPayments(payments.slice(0, 8))
    } catch {
      /* chargement best-effort, liste vide si échec */
    }
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await apiClient.payments.create(paymentData)
      notify.success('Paiement enregistré', 'Le paiement a été créé et apparaît dans la liste récente.')
      setShowPaymentModal(false)
      setPaymentData({
        amount: 0,
        method: PaymentMethodEnum.MOBILE_MONEY,
        phoneNumber: '',
      })
      loadRecentData()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la création du paiement'
      notify.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Espace vendeur</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-ink-900">Bienvenue</h1>
          <p className="mt-2 max-w-xl text-ink-600">
            Les tickets proviennent de l&apos;import CSV (admin). Vous les vendez au tarif fixe par type (24h, 7j, 30j).
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.push('/buy-ticket')}
            className="btn btn-primary flex items-center gap-2"
          >
            <ShoppingCart className="h-5 w-5" />
            Vendre un ticket
          </button>
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <DollarSign className="h-5 w-5" />
            Enregistrer un paiement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          type="button"
          className="card text-left cursor-pointer hover:shadow-lg transition-shadow w-full"
          onClick={() => router.push('/buy-ticket')}
        >
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary-100 rounded-full">
              <ShoppingCart className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-ink-900">Catalogue & achat</h3>
              <p className="text-sm text-ink-600">
                Choisir un forfait 24h, 7 jours ou 30 jours et attribuer un ticket disponible au client.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="card text-left cursor-pointer hover:shadow-lg transition-shadow w-full"
          onClick={() => router.push('/payments')}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-emerald-100 p-4">
              <CreditCard className="h-8 w-8 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-semibold text-ink-900">Paiements</h3>
              <p className="text-sm text-ink-600">Historique et suivi des encaissements.</p>
            </div>
          </div>
        </button>
      </div>

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-ink-900">Paiements récents</h2>
        {recentPayments.length === 0 ? (
          <p className="py-4 text-center text-ink-500">Aucun paiement récent</p>
        ) : (
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-ink-200 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">{payment.amount.toLocaleString()} CDF</p>
                    <p className="text-sm text-ink-600">
                      {paymentMethodLabels[payment.method]}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {payment.phoneNumber || '—'}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      payment.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-900'
                        : payment.status === 'pending'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-900'
                    }`}
                  >
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="mb-4 text-xl font-bold text-ink-900">Enregistrer un paiement</h2>
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-ink-700">Montant (CDF) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={paymentData.amount || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                  className="input"
                  placeholder={
                    amountPlaceholder || 'Montant selon le tarif du type de ticket (catalogue API)'
                  }
                />
              </div>

              <div>
                <label htmlFor="payment-method" className="mb-2 block text-sm font-medium text-ink-700">
                  Méthode *
                </label>
                <select
                  id="payment-method"
                  value={paymentData.method}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, method: e.target.value as CreatePaymentRequest['method'] })
                  }
                  className="input"
                >
                  <option value={PaymentMethodEnum.MOBILE_MONEY}>Mobile Money</option>
                  <option value={PaymentMethodEnum.CASH}>Espèces</option>
                  <option value={PaymentMethodEnum.CARD}>Carte</option>
                </select>
              </div>

              {(paymentData.method === PaymentMethodEnum.MOBILE_MONEY ||
                paymentData.method === PaymentMethodEnum.CARD) && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-700">Téléphone</label>
                  <input
                    type="tel"
                    value={paymentData.phoneNumber || ''}
                    onChange={(e) => setPaymentData({ ...paymentData, phoneNumber: e.target.value })}
                    className="input"
                    placeholder="+243900000000"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 btn btn-secondary"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button type="submit" className="flex-1 btn btn-primary" disabled={loading}>
                  {loading ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
