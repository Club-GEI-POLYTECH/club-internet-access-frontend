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
    } catch {
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
            <Ticket className="mx-auto mb-4 h-12 w-12 text-ink-400" />
            <p className="mb-4 text-ink-500">Aucun ticket pour le moment.</p>
            <button type="button" onClick={() => router.push('/buy-ticket')} className="btn btn-primary">
              Voir les forfaits
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {myTickets.map((t) => (
              <div key={t.id} className="rounded-lg border border-ink-200 p-4 transition-colors hover:bg-ink-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-lg font-semibold text-ink-900">{t.username}</p>
                    <p className="text-sm text-ink-600">
                      {t.soldAt ? `Acheté le ${format(new Date(t.soldAt), 'dd MMM yyyy HH:mm', { locale: fr })}` : '—'}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">Statut : {t.status}</p>
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
          <p className="py-4 text-center text-ink-500">Aucun paiement</p>
        ) : (
          <div className="space-y-3">
            {myPayments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-ink-200 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">{payment.amount.toLocaleString()} CDF</p>
                    <p className="text-sm text-ink-600">
                      {payment.createdAt && format(new Date(payment.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
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
    </div>
  )
}
