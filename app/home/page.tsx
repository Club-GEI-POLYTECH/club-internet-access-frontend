'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wifi, Clock, HardDrive, ArrowRight, ShoppingCart } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import type { TicketType } from '@/types/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Page d'accueil publique - Liste des types de tickets disponibles
 * 
 * Cette page affiche les différents types de tickets Wi-Fi disponibles
 * et permet de rediriger vers la page d'achat
 */
export default function HomePage() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    loadTicketTypes()
  }, [])

  const loadTicketTypes = async () => {
    logger.log('Home: chargement des types de tickets')
    try {
      const data = await apiClient.tickets.getTypes()
      const availableTypes = data.filter(type => type.isActive && type.availableCount > 0)
      setTicketTypes(availableTypes)
      logger.info('Home: types chargés', { total: data.length, disponibles: availableTypes.length })
    } catch (error: any) {
      logger.error('Home: erreur chargement types', error)
      toast.error('Erreur lors du chargement des types de tickets')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatLimit = (limit?: string) => {
    if (!limit) return 'Illimité'
    return limit
  }

  const handleBuyTicket = (typeId: string) => {
    logger.log('Home: achat ticket, type sélectionné', { typeId })
    const target = `/buy-ticket?type=${typeId}`

    if (!user) {
      const redirectTo = encodeURIComponent(target)
      router.push(`/login?redirectTo=${redirectTo}`)
      return
    }

    router.push(target)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700">
      {/* Header */}
      <div className="bg-white bg-opacity-10 backdrop-blur-sm border-b border-white border-opacity-20 animate-fade-in-down">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg transition-transform duration-300 hover:scale-110">
                <Wifi className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Club Internet Access</h1>
                <p className="text-white text-opacity-90 text-sm">Université de Kinshasa - UNIKIN</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95"
              >
                Connexion
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="mb-12 opacity-0 animate-fade-in-up [animation-fill-mode:forwards] [animation-delay:100ms]">
          <h2 className="text-5xl font-bold text-white mb-4">
            Achetez votre accès Wi-Fi
          </h2>
          <p className="text-xl text-white text-opacity-90 max-w-2xl mx-auto">
            Choisissez le forfait qui correspond à vos besoins et connectez-vous en quelques minutes
          </p>
        </div>

        {loading ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-12 animate-fade-in">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-white text-opacity-90">Chargement des forfaits...</p>
          </div>
        ) : ticketTypes.length === 0 ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-12 animate-scale-in">
            <ShoppingCart className="h-16 w-16 text-white text-opacity-50 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">
              Aucun forfait disponible
            </h3>
            <p className="text-white text-opacity-90">
              Tous les tickets ont été vendus. Veuillez réessayer plus tard.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ticketTypes.map((type, index) => (
              <div
                key={type.id}
                className={`bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] opacity-0 animate-fade-in-up [animation-fill-mode:forwards] ${index === 0 ? '[animation-delay:150ms]' : index === 1 ? '[animation-delay:250ms]' : index === 2 ? '[animation-delay:350ms]' : '[animation-delay:500ms]'}`}
              >
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                    <Wifi className="h-8 w-8 text-primary-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {type.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {type.description}
                  </p>
                  <div className="text-4xl font-bold text-primary-600 mb-2">
                    {formatPrice(type.price)}
                  </div>
                  <p className="text-xs text-gray-500">
                    {type.availableCount} ticket{type.availableCount > 1 ? 's' : ''} disponible{type.availableCount > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  {type.timeLimit && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4 text-primary-600" />
                      <span>Durée: <strong>{formatLimit(type.timeLimit)}</strong></span>
                    </div>
                  )}
                  {type.dataLimit && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <HardDrive className="h-4 w-4 text-primary-600" />
                      <span>Données: <strong>{formatLimit(type.dataLimit)}</strong></span>
                    </div>
                  )}
                  {!type.timeLimit && !type.dataLimit && (
                    <div className="text-sm text-gray-600">
                      <span>Durée et données <strong>illimitées</strong></span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleBuyTicket(type.id)}
                  className="w-full btn btn-primary py-3 text-base font-semibold flex items-center justify-center gap-2 group"
                >
                  Acheter maintenant
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center opacity-0 animate-fade-in [animation-fill-mode:forwards] [animation-delay:600ms]">
          <p className="text-white text-opacity-75 text-sm">
            Besoin d'aide ? Contactez-nous à president@clubgei-polytech.org
          </p>
        </div>
      </div>
    </div>
  )
}
