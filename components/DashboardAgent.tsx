'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { ticketTypesPricePlaceholder } from '@/lib/ticket-type-price-placeholder'
import { DollarSign, ShoppingCart, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
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
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    }
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await apiClient.payments.create(paymentData)
      toast.success('Paiement créé avec succès!')
      setShowPaymentModal(false)
      setPaymentData({
        amount: 0,
        method: PaymentMethodEnum.MOBILE_MONEY,
        phoneNumber: '',
      })
      loadRecentData()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la création du paiement'
      toast.error(message)
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
              <h3 className="font-semibold text-gray-900">Catalogue & achat</h3>
              <p className="text-sm text-gray-600">
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
            <div className="p-4 bg-green-100 rounded-full">
              <CreditCard className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Paiements</h3>
              <p className="text-sm text-gray-600">Historique et suivi des encaissements.</p>
            </div>
          </div>
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Paiements récents</h2>
        {recentPayments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Aucun paiement récent</p>
        ) : (
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{payment.amount.toLocaleString()} CDF</p>
                    <p className="text-sm text-gray-600">
                      {paymentMethodLabels[payment.method]}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {payment.phoneNumber || '—'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      payment.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : payment.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
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
            <h2 className="text-xl font-bold mb-4">Enregistrer un paiement</h2>
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant (CDF) *</label>
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
                <label htmlFor="payment-method" className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
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
