'use client'

import { useEffect, useState } from 'react'
import { paymentsService } from '@/services/api'
import { apiClient } from '@/lib/api-client'
import { ticketTypesPricePlaceholder } from '@/lib/ticket-type-price-placeholder'
import { Plus, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import type { Payment } from '@/types/api'

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    method: 'mobile_money' as const,
    phoneNumber: '',
    wifiAccountId: '',
  })
  const [amountPlaceholder, setAmountPlaceholder] = useState('')

  useEffect(() => {
    loadPayments()
    apiClient.tickets
      .getTypes()
      .then((types) => setAmountPlaceholder(ticketTypesPricePlaceholder(types)))
      .catch(() => setAmountPlaceholder(''))
  }, [])

  const loadPayments = async () => {
    try {
      const data = await paymentsService.getAll()
      setPayments(data)
    } catch (error: any) {
      toast.error('Erreur lors du chargement des paiements')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await paymentsService.create(formData)
      toast.success('Paiement créé avec succès!')
      setShowCreateModal(false)
      setFormData({ amount: '', method: 'mobile_money', phoneNumber: '', wifiAccountId: '' })
      loadPayments()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la création')
    }
  }

  const handleComplete = async (id: string, transactionId?: string) => {
    try {
      await paymentsService.complete(id, transactionId)
      toast.success('Paiement complété!')
      loadPayments()
    } catch (error: any) {
      toast.error('Erreur lors de la complétion')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          En attente
        </span>
      ),
      completed: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Complété
        </span>
      ),
      failed: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="h-3 w-3 mr-1" />
          Échoué
        </span>
      ),
      cancelled: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <XCircle className="h-3 w-3 mr-1" />
          Annulé
        </span>
      ),
    }
    return badges[status as keyof typeof badges] || badges.pending
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paiements</h1>
          <p className="text-gray-600 mt-1">
            Revenus total: <span className="font-semibold text-green-600">{totalRevenue.toLocaleString()} CDF</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouveau paiement
        </button>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Créer un paiement</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (CDF)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input"
                  placeholder={
                    amountPlaceholder || 'Montant selon le tarif du type de ticket (catalogue API)'
                  }
                />
              </div>

              <div>
                <label htmlFor="payments-create-method" className="block text-sm font-medium text-gray-700 mb-2">
                  Méthode de paiement
                </label>
                <select
                  id="payments-create-method"
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                  className="input"
                >
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cash">Espèces</option>
                  <option value="card">Carte</option>
                </select>
              </div>

              {formData.method === 'mobile_money' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro de téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="input"
                    placeholder="+243900000000"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="flex-1 btn btn-primary">
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Méthode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 text-green-600 mr-2" />
                      <span className="font-semibold">{payment.amount.toLocaleString()} CDF</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getMethodLabel(payment.method)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {payment.transactionId || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {payment.status === 'pending' && (
                      <button
                        onClick={() => handleComplete(payment.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Compléter
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun paiement enregistré</p>
          </div>
        )}
      </div>
    </div>
  )
}

