'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wifi, Clock, HardDrive, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import type { Ticket } from '@/types/api'
import { TicketStatus } from '@/types/api'
import { api } from '@/lib/api'
import { logger } from '@/lib/logger'

export default function MyTicketsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      logger.log('MyTickets: utilisateur non authentifié, redirection vers /login')
      const redirectTo = encodeURIComponent('/my-tickets')
      router.replace(`/login?redirectTo=${redirectTo}`)
      return
    }

    const fetchTickets = async () => {
      logger.log('MyTickets: chargement des tickets de l’utilisateur connecté')
      try {
        const data = await api.get<Ticket[]>('/me/tickets')
        setTickets(data)
        logger.info('MyTickets: tickets chargés', { count: data.length })
      } catch (error: any) {
        logger.error('MyTickets: erreur chargement tickets', error)
        toast.error('Erreur lors du chargement de vos tickets')
      } finally {
        setLoading(false)
      }
    }

    fetchTickets()
  }, [user, authLoading, router])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDateTime = (value?: string) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('fr-FR')
  }

  const formatStatus = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.AVAILABLE:
        return 'Disponible'
      case TicketStatus.RESERVED:
        return 'Réservé'
      case TicketStatus.SOLD:
        return 'Vendu'
      case TicketStatus.EXPIRED:
        return 'Expiré'
      default:
        return status
    }
  }

  if (authLoading || (user == null && typeof window !== 'undefined')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 text-white">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white bg-opacity-20 rounded-full">
              <Wifi className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mes tickets Wi-Fi</h1>
              <p className="text-sm text-white text-opacity-80">
                Historique de vos achats de tickets de connexion
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-white text-opacity-90">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4" />
              <p>Chargement de vos tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white text-opacity-90">
              <ShoppingCart className="h-12 w-12 mb-4 text-white text-opacity-70" />
              <h2 className="text-xl font-semibold mb-2">Aucun ticket trouvé</h2>
              <p className="mb-4 text-center max-w-md">
                Vous n’avez pas encore acheté de ticket de connexion avec ce compte.
              </p>
              <button
                onClick={() => router.push('/home')}
                className="btn btn-primary px-6 py-2"
              >
                Acheter un ticket
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-white rounded-xl shadow-md p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {ticket.profile}
                      </h3>
                      <p className="text-xs text-gray-500">
                        ID: {ticket.id.slice(0, 8)}...
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        ticket.status === TicketStatus.SOLD
                          ? 'bg-green-100 text-green-700'
                          : ticket.status === TicketStatus.EXPIRED
                          ? 'bg-red-100 text-red-700'
                          : ticket.status === TicketStatus.RESERVED
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {formatStatus(ticket.status)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-primary-600" />
                      <span>
                        Durée:{' '}
                        <strong>{ticket.timeLimit ? ticket.timeLimit : 'Illimitée'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-4 w-4 text-primary-600" />
                      <span>
                        Données:{' '}
                        <strong>{ticket.dataLimit ? ticket.dataLimit : 'Illimitées'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-700">
                    <p>
                      Prix:{' '}
                      <strong>{formatPrice(ticket.price)}</strong>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Acheté le: {formatDateTime(ticket.soldAt || ticket.createdAt)}
                    </p>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    <p>
                      Nom d&apos;utilisateur MikroTik:{' '}
                      <span className="font-mono break-all">{ticket.username}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

