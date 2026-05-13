'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, ShoppingCart, CreditCard } from 'lucide-react'
import { notify } from '@/lib/notify'
import type { Payment, Ticket as TicketModel } from '@/types/api'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { apiClient } from '@/lib/api-client'

export default function DashboardStudent() {
  const router = useRouter()
  const [myTickets, setMyTickets] = useState<TicketModel[]>([])
  const [myPayments, setMyPayments] = useState<Payment[]>([])

  useEffect(() => {
    loadMyData()
  }, [])

  const loadMyData = async () => {
    try {
      const [tickets, payments] = await Promise.all([
        apiClient.tickets.mine().catch(() => []),
        apiClient.payments.list().catch(() => []),
      ])
      setMyTickets(Array.isArray(tickets) ? tickets.slice(0, 6) : [])
      setMyPayments(payments.slice(0, 6))
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
      notify.error('Données indisponibles', 'Impossible de charger votre espace. Actualisez la page.')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    notify.success('Copié', 'Le contenu est dans le presse-papier.')
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Mon espace</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-ink-900">Bonjour</h1>
          <p className="mt-2 max-w-xl text-ink-600">
            Achetez un forfait (24h, 7j, 30j) et retrouvez vos codes ici.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => router.push('/buy-ticket')} className="btn btn-primary flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Acheter un ticket
          </button>
          <button type="button" onClick={() => router.push('/my-tickets')} className="btn btn-secondary flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Tous mes tickets
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Mes derniers tickets</h2>
          <button
            type="button"
            onClick={() => router.push('/my-tickets')}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Voir tout
          </button>
        </div>
        {myTickets.length === 0 ? (
          <div className="text-center py-8">
            <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Aucun ticket pour le moment.</p>
            <button type="button" onClick={() => router.push('/buy-ticket')} className="btn btn-primary">
              Voir les forfaits
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {myTickets.map((t) => (
              <div key={t.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div>
                    <p className="font-mono font-semibold text-lg">{t.username}</p>
                    <p className="text-sm text-gray-600">
                      {t.soldAt ? `Acheté le ${format(new Date(t.soldAt), 'dd MMM yyyy HH:mm', { locale: fr })}` : '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Statut : {t.status}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${t.username} / ${t.password ?? ''}`)}
                    className="btn btn-sm btn-secondary self-start"
                  >
                    Copier identifiants
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Mes paiements</h2>
          <button
            type="button"
            onClick={() => router.push('/payments')}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <CreditCard className="h-4 w-4" />
            Voir tout
          </button>
        </div>
        {myPayments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Aucun paiement</p>
        ) : (
          <div className="space-y-3">
            {myPayments.map((payment) => (
              <div key={payment.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{payment.amount.toLocaleString()} CDF</p>
                    <p className="text-sm text-gray-600">
                      {payment.createdAt && format(new Date(payment.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
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
    </div>
  )
}
