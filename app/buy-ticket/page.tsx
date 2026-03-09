'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wifi, ShoppingCart, CheckCircle, Copy, Clock, HardDrive, CreditCard } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import type { Ticket, TicketType, TicketPurchaseRequest, TicketPurchaseResponse } from '@/types/api'
import { PaymentMethod } from '@/types/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Page publique de vente de tickets Wi-Fi
 * 
 * Cette page permet aux utilisateurs d'acheter des tickets pré-générés
 * depuis Mikhmon sans avoir besoin de se connecter.
 */
export default function BuyTicketPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketType, setTicketType] = useState<TicketType | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<TicketPurchaseResponse | null>(null)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      logger.log('BuyTicket: utilisateur non authentifié, redirection vers /login')
      const search = typeof window !== 'undefined' ? window.location.search : ''
      const redirectTo = `/buy-ticket${search || ''}`
      const encoded = encodeURIComponent(redirectTo)
      router.replace(`/login?redirectTo=${encoded}`)
      return
    }

    const params = new URLSearchParams(window.location.search)
    const typeId = params.get('type')
    logger.log('BuyTicket: chargement', { typeId: typeId ?? 'tous' })
    if (typeId) {
      loadTicketType(typeId)
    } else {
      loadAvailableTickets()
    }
  }, [user, authLoading, router])

  const loadTicketType = async (typeId: string) => {
    logger.log('BuyTicket: chargement type', { typeId })
    try {
      const [typeData, ticketsData] = await Promise.all([
        apiClient.tickets.getTypes().then(types => types.find(t => t.id === typeId)),
        apiClient.tickets.getByType(typeId)
      ])
      if (typeData) {
        setTicketType(typeData)
        const available = ticketsData.filter(t => t.status === 'available')
        setTickets(available)
        logger.info('BuyTicket: type et tickets chargés', { typeId, count: available.length })
      } else {
        logger.warn('BuyTicket: type non trouvé', { typeId })
        toast.error('Type de ticket non trouvé')
        router.push('/home')
      }
    } catch (error: any) {
      logger.error('BuyTicket: erreur chargement type', { typeId }, error)
      toast.error('Erreur lors du chargement du type de ticket')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableTickets = async () => {
    logger.log('BuyTicket: chargement tickets disponibles')
    try {
      const data = await apiClient.tickets.getAvailable()
      setTickets(data)
      logger.info('BuyTicket: tickets chargés', { count: data.length })
    } catch (error: any) {
      logger.error('BuyTicket: erreur chargement tickets', error)
      toast.error('Erreur lors du chargement des tickets')
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async () => {
    if (!selectedTicket || !phoneNumber.trim()) {
      logger.warn('BuyTicket: achat refusé, ticket ou téléphone manquant')
      toast.error('Veuillez sélectionner un ticket et entrer votre numéro de téléphone')
      return
    }
    const phoneRegex = /^(\+243|0)[0-9]{9}$/
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      logger.warn('BuyTicket: numéro de téléphone invalide')
      toast.error('Veuillez entrer un numéro de téléphone valide (ex: +243900000000 ou 0900000000)')
      return
    }
    logger.log('BuyTicket: achat en cours', { ticketId: selectedTicket.id, phone: phoneNumber })
    setPurchasing(true)
    try {
      const purchaseData: TicketPurchaseRequest = {
        ticketId: selectedTicket.id,
        phoneNumber: phoneNumber.replace(/\s/g, ''),
        method: PaymentMethod.MOBILE_MONEY,
      }
      const result = await apiClient.tickets.purchase(purchaseData)
      setPurchaseResult(result)
      toast.success('Ticket acheté avec succès!')
      logger.info('BuyTicket: achat réussi', { ticketId: selectedTicket.id })
      await loadAvailableTickets()
      setSelectedTicket(null)
      setPhoneNumber('')
    } catch (error: any) {
      logger.error('BuyTicket: achat échoué', error)
      toast.error(error.message || 'Erreur lors de l\'achat du ticket')
    } finally {
      setPurchasing(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    logger.log('BuyTicket: copié dans presse-papier', { label })
    toast.success(`${label} copié dans le presse-papier!`)
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

  if (authLoading || (!user && typeof window !== 'undefined')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    )
  }

  if (purchaseResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-12">
        <div className="max-w-2xl w-full animate-scale-in">
          <div className="bg-white rounded-2xl shadow-xl p-8 transition-shadow duration-300 hover:shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 animate-pulse-soft">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Achat réussi!
              </h1>
              <p className="text-gray-600">
                Voici vos identifiants de connexion Wi-Fi
              </p>
            </div>

            <div className="bg-primary-50 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Identifiants de connexion
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="username-display" className="block text-sm font-medium text-gray-700 mb-2">
                    Nom d'utilisateur
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="username-display"
                      type="text"
                      readOnly
                      value={purchaseResult.credentials.username}
                      className="flex-1 input bg-gray-50 font-mono"
                      aria-label="Nom d'utilisateur"
                    />
                    <button
                      onClick={() => copyToClipboard(purchaseResult.credentials.username, 'Nom d\'utilisateur')}
                      className="btn btn-secondary px-4"
                      aria-label="Copier le nom d'utilisateur"
                      title="Copier le nom d'utilisateur"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="password-display" className="block text-sm font-medium text-gray-700 mb-2">
                    Mot de passe
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="password-display"
                      type="text"
                      readOnly
                      value={purchaseResult.credentials.password}
                      className="flex-1 input bg-gray-50 font-mono"
                      aria-label="Mot de passe"
                    />
                    <button
                      onClick={() => copyToClipboard(purchaseResult.credentials.password, 'Mot de passe')}
                      className="btn btn-secondary px-4"
                      aria-label="Copier le mot de passe"
                      title="Copier le mot de passe"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-display" className="block text-sm font-medium text-gray-700 mb-2">
                    Profil
                  </label>
                  <input
                    id="profile-display"
                    type="text"
                    readOnly
                    value={purchaseResult.credentials.profile}
                    className="input bg-gray-50"
                    aria-label="Profil"
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
              <p className="text-sm text-blue-800 whitespace-pre-line">
                {purchaseResult.credentials.instructions}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPurchaseResult(null)
                  setSelectedTicket(null)
                }}
                className="flex-1 btn btn-secondary"
              >
                Acheter un autre ticket
              </button>
              <button
                onClick={() => {
                  // Copier les deux identifiants
                  const credentials = `${purchaseResult.credentials.username}\n${purchaseResult.credentials.password}`
                  copyToClipboard(credentials, 'Identifiants')
                }}
                className="flex-1 btn btn-primary"
              >
                Copier les identifiants
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-down">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4 transition-transform duration-300 hover:scale-110">
            <Wifi className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {ticketType ? ticketType.name : 'Acheter un ticket Wi-Fi'}
          </h1>
          <p className="text-white text-opacity-90">
            {ticketType ? ticketType.description : 'Club Internet Access - Université de Kinshasa'}
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center animate-scale-in">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement des tickets disponibles...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center animate-scale-in">
            <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Aucun ticket disponible
            </h2>
            <p className="text-gray-600">
              Tous les tickets ont été vendus. Veuillez réessayer plus tard.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Liste des tickets disponibles */}
            <div className="bg-white rounded-2xl shadow-xl p-6 animate-fade-in-up opacity-0 transition-shadow duration-300 hover:shadow-2xl" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Tickets disponibles ({tickets.length})
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {tickets.map((ticket, index) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-300 hover:scale-[1.01] ${
                      selectedTicket?.id === ticket.id
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {ticket.profile}
                          </span>
                          <span className="text-2xl font-bold text-primary-600">
                            {formatPrice(ticket.price)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                          {ticket.timeLimit && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{formatLimit(ticket.timeLimit)}</span>
                            </div>
                          )}
                          {ticket.dataLimit && (
                            <div className="flex items-center gap-1">
                              <HardDrive className="h-4 w-4" />
                              <span>{formatLimit(ticket.dataLimit)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Formulaire d'achat */}
            <div className="bg-white rounded-2xl shadow-xl p-6 animate-fade-in-up opacity-0 transition-shadow duration-300 hover:shadow-2xl" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Informations d'achat
              </h2>

              {selectedTicket ? (
                <div className="space-y-6">
                  {/* Résumé du ticket sélectionné */}
                  <div className="bg-primary-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Ticket sélectionné
                    </h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Profil:</span>
                        <span className="font-medium">{selectedTicket.profile}</span>
                      </div>
                      {selectedTicket.timeLimit && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Durée:</span>
                          <span className="font-medium">{formatLimit(selectedTicket.timeLimit)}</span>
                        </div>
                      )}
                      {selectedTicket.dataLimit && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Données:</span>
                          <span className="font-medium">{formatLimit(selectedTicket.dataLimit)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-primary-200">
                        <span className="text-gray-900 font-semibold">Prix:</span>
                        <span className="text-primary-600 font-bold text-lg">
                          {formatPrice(selectedTicket.price)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Numéro de téléphone */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro de téléphone Mobile Money *
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+243900000000 ou 0900000000"
                      className="input"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Format: +243900000000 ou 0900000000
                    </p>
                  </div>

                  {/* Méthode de paiement */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Méthode de paiement
                    </label>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <CreditCard className="h-5 w-5 text-primary-600" />
                      <span className="font-medium">Mobile Money</span>
                    </div>
                  </div>

                  {/* Bouton d'achat */}
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || !phoneNumber.trim()}
                    className="w-full btn btn-primary py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Traitement en cours...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Acheter maintenant
                      </>
                    )}
                  </button>

                  <div className="text-xs text-gray-500 text-center">
                    <p>En achetant, vous acceptez nos conditions d'utilisation</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Sélectionnez un ticket pour continuer</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
