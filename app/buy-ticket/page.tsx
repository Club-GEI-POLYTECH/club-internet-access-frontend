'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Wifi,
  ShoppingCart,
  CheckCircle,
  Copy,
  Clock,
  HardDrive,
  CreditCard,
  ArrowRight,
  LayoutDashboard,
  Ticket as TicketIcon,
  Banknote,
  Ban,
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { parseApiDecimal } from '@/lib/normalize-ticket-api'
import { logger } from '@/lib/logger'
import type { Ticket, TicketType, TicketPurchaseRequest, TicketPurchaseResponse, Payment } from '@/types/api'
import { PaymentMethod, TicketStatus } from '@/types/api'
import {
  classifyKelpayVerifyDecision,
  isKelpayPaymentFailureStatus,
  isKelpayPaymentPendingOrProcessing,
  isKelpayPaymentSuccessStatus,
  kelpayVerifyPaymentStatusRaw,
  kelpayVerifyReadyToConfirm,
} from '@/types/frontend-types'
import { notify } from '@/lib/notify'
import { useAuth } from '@/contexts/AuthContext'

function BuyTicketFallback() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-90" />
      <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-primary-300" />
    </div>
  )
}

function credentialsFromTicket(ticket: Ticket): TicketPurchaseResponse['credentials'] {
  return {
    username: ticket.username,
    password: ticket.password,
    profile: ticket.profile,
    instructions:
      'Connectez-vous au réseau Wi-Fi du club avec ces identifiants. Vous pouvez aussi retrouver vos codes dans Mes tickets.',
  }
}

/** Unitaire pour affichage / Mobile Money : prix du ticket si présent, sinon prix du type. */
function effectiveUnitPrice(ticket: Ticket, typeFallback?: number | null): number | undefined {
  const fromTicket = parseApiDecimal(ticket.price)
  if (Number.isFinite(fromTicket)) return fromTicket
  const fromType = parseApiDecimal(typeFallback)
  if (Number.isFinite(fromType)) return fromType
  return undefined
}

/** Montant `POST /payments/initiate` : doit correspondre au prix du type (`ticketType.price`) côté backend. */
function kelpayTypePriceCdf(ticketType: TicketType | null): number | undefined {
  if (!ticketType) return undefined
  const p = parseApiDecimal(ticketType.price)
  if (!Number.isFinite(p) || p <= 0) return undefined
  return p
}

/** Reprise après F5 : mémorisé uniquement sur cet onglet (sessionStorage). */
const KELPAY_PENDING_KEY = 'clubia:kelpay-pending-payment'

type KelpayPendingPayload = { paymentId: string; ticketId: string; typeId: string }

function readKelpayPending(): KelpayPendingPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KELPAY_PENDING_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as KelpayPendingPayload
    if (o?.paymentId && o?.ticketId && typeof o.typeId === 'string') return o
    return null
  } catch {
    return null
  }
}

function writeKelpayPending(payload: KelpayPendingPayload) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(KELPAY_PENDING_KEY, JSON.stringify(payload))
}

function clearKelpayPendingStorage() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(KELPAY_PENDING_KEY)
}

async function fetchTicketAfterKelpay(ticketId: string, paymentId: string): Promise<Ticket | null> {
  const delays = [0, 1500, 2500, 3500, 5000]
  for (const ms of delays) {
    if (ms > 0) await new Promise((r) => setTimeout(r, ms))
    const list = await apiClient.tickets.mine()
    const byPayment = list.find((t) => t.paymentId === paymentId)
    if (byPayment) return byPayment
    const byId = list.find((t) => t.id === ticketId && t.status === TicketStatus.SOLD)
    if (byId) return byId
  }
  return null
}

/**
 * Achat de tickets : compte obligatoire.
 * Sans `?type=` : choix du forfait (24h, 7j, 30j…). Avec `?type=` : liste des tickets disponibles pour ce type.
 */
function BuyTicketContent() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketType, setTicketType] = useState<TicketType | null>(null)
  const [catalogTypes, setCatalogTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<TicketPurchaseResponse | null>(null)
  const [checkoutMethod, setCheckoutMethod] = useState<'kelpay' | 'cash'>('kelpay')
  const [paymentHint, setPaymentHint] = useState<string | null>(null)
  const [kelpaySession, setKelpaySession] = useState<{ paymentId: string; ticketId: string } | null>(null)
  const [kelpayReadyToConfirm, setKelpayReadyToConfirm] = useState(false)
  const [kelpaySubmitting, setKelpaySubmitting] = useState<
    'init' | 'verify' | 'confirm' | 'refresh' | 'cancel' | null
  >(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeId = searchParams.get('type')
  const { user, loading: authLoading } = useAuth()

  const clearKelpaySessionAfterFailure = useCallback(async () => {
    clearKelpayPendingStorage()
    setKelpaySession(null)
    setKelpayReadyToConfirm(false)
    if (typeId) {
      const ticketsData = await apiClient.tickets.getByType(typeId)
      setTickets(ticketsData.filter((t) => t.status === 'available'))
    }
  }, [typeId])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      logger.log('BuyTicket: non authentifié → /login')
      const q = searchParams.toString()
      const redirectTo = encodeURIComponent(q ? `/buy-ticket?${q}` : '/buy-ticket')
      router.replace(`/login?redirectTo=${redirectTo}`)
      return
    }

    let cancelled = false

    const run = async () => {
      if (typeId) {
        setLoading(true)
        setCatalogTypes([])
        logger.log('BuyTicket: chargement type', { typeId })
        try {
          const [types, ticketsData] = await Promise.all([
            apiClient.tickets.getTypes(),
            apiClient.tickets.getByType(typeId),
          ])
          if (cancelled) return
          const typeData = types.find((t) => t.id === typeId)
          if (typeData) {
            const available = ticketsData.filter((t) => t.status === 'available')
            setTicketType(typeData)
            setTickets(available)
            if (!cancelled && typeof window !== 'undefined') {
              const pending = readKelpayPending()
              if (pending && pending.typeId === typeId) {
                try {
                  const payment = await apiClient.payments.getById(pending.paymentId)
                  if (cancelled) return
                  const st = String(payment.status)
                  if (isKelpayPaymentSuccessStatus(st) || isKelpayPaymentFailureStatus(st)) {
                    clearKelpayPendingStorage()
                  } else {
                    setKelpaySession({ paymentId: pending.paymentId, ticketId: pending.ticketId })
                    setCheckoutMethod('kelpay')
                    const t = available.find((x) => x.id === pending.ticketId)
                    if (t) setSelectedTicket(t)
                    notify.info(
                      'Paiement en cours',
                      'Reprise d’un paiement Mobile Money sur cet appareil après rafraîchissement de la page.',
                      { duration: 5500 },
                    )
                  }
                } catch {
                  clearKelpayPendingStorage()
                }
              }
            }
            logger.info('BuyTicket: type chargé', {
              typeId,
              ticketsTotal: ticketsData.length,
              ticketsDisponibles: available.length,
            })
            logger.debug('BuyTicket: acquisition détail (résumé)', {
              typeId,
              typeRésolu: {
                id: typeData.id,
                name: typeData.name,
                price: typeData.price,
                availableCount: typeData.availableCount,
                isActive: typeData.isActive,
              },
              échantillonTickets: ticketsData.slice(0, 8).map((t) => ({
                id: t.id,
                status: t.status,
                profile: t.profile,
                priceBrut: t.price,
                prixEffectif: effectiveUnitPrice(t, typeData.price),
              })),
            })
          } else {
            notify.error('Type de ticket non trouvé')
            router.replace('/buy-ticket')
          }
        } catch (error: unknown) {
          logger.error('BuyTicket: erreur chargement type', { typeId }, error)
          notify.error('Erreur lors du chargement du type de ticket')
        } finally {
          if (!cancelled) setLoading(false)
        }
      } else {
        setLoading(true)
        setTicketType(null)
        setTickets([])
        setSelectedTicket(null)
        logger.log('BuyTicket: chargement catalogue (types)')
        try {
          const data = await apiClient.tickets.getTypes()
          if (cancelled) return
          const availableTypes = data.filter((t) => t.isActive && t.availableCount > 0)
          setCatalogTypes(availableTypes)
          logger.info('BuyTicket: types catalogue', {
            totalApi: data.length,
            affichésActifsEnStock: availableTypes.length,
          })
          logger.debug('BuyTicket: acquisition catalogue (résumé)', {
            totalApi: data.length,
            aprèsFiltre: availableTypes.length,
            types: availableTypes.map((t) => ({
              id: t.id,
              name: t.name,
              price: t.price,
              availableCount: t.availableCount,
              isActive: t.isActive,
            })),
          })
        } catch (error: unknown) {
          logger.error('BuyTicket: erreur catalogue', error)
          notify.error('Erreur lors du chargement des forfaits')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, typeId, router])

  useEffect(() => {
    if (checkoutMethod === 'cash') {
      setKelpaySession(null)
      setKelpayReadyToConfirm(false)
      clearKelpayPendingStorage()
    }
  }, [checkoutMethod])

  useEffect(() => {
    if (!kelpaySession || !selectedTicket) return
    if (selectedTicket.id !== kelpaySession.ticketId) {
      void clearKelpaySessionAfterFailure()
    }
  }, [selectedTicket?.id, kelpaySession, clearKelpaySessionAfterFailure])

  const finalizeKelpaySuccess = async (paymentId: string, ticketId: string, finalPayment: Payment) => {
    setPaymentHint('Récupération de votre ticket…')
    const ticket = await fetchTicketAfterKelpay(ticketId, paymentId)
    clearKelpayPendingStorage()
    setKelpaySession(null)
    setKelpayReadyToConfirm(false)
    setPaymentHint(null)
    if (!ticket) {
      notify.success('Paiement confirmé. Retrouvez votre ticket dans Mes tickets.')
      logger.info('BuyTicket: Kelpay OK mais ticket pas encore listé', { paymentId })
      if (typeId) {
        const ticketsData = await apiClient.tickets.getByType(typeId)
        setTickets(ticketsData.filter((t) => t.status === 'available'))
      }
      setSelectedTicket(null)
      setPhoneNumber('')
      router.push('/my-tickets')
      return
    }
    setPurchaseResult({
      ticket,
      payment: finalPayment,
      credentials: credentialsFromTicket(ticket),
    })
    notify.success('Votre ticket est activé.')
    logger.info('BuyTicket: Kelpay réussi', { ticketId: ticket.id, paymentId })
    if (typeId) {
      const ticketsData = await apiClient.tickets.getByType(typeId)
      setTickets(ticketsData.filter((t) => t.status === 'available'))
    }
    setSelectedTicket(null)
    setPhoneNumber('')
  }

  const handleCashPurchase = async () => {
    if (!selectedTicket || !phoneNumber.trim() || !user) {
      logger.warn('BuyTicket: achat refusé, ticket, téléphone ou utilisateur manquant')
      notify.error('Veuillez sélectionner un ticket et entrer votre numéro de téléphone')
      return
    }
    const phoneRegex = /^(\+243|0)[0-9]{9}$/
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      logger.warn('BuyTicket: numéro de téléphone invalide')
      notify.error('Veuillez entrer un numéro de téléphone valide (ex: +243900000000 ou 0900000000)')
      return
    }
    const normalizedPhone = phoneNumber.replace(/\s/g, '')

    logger.log('BuyTicket: achat cash', { ticketId: selectedTicket.id, phone: normalizedPhone })
    setPurchasing(true)
    setPaymentHint(null)
    try {
      const purchaseData: TicketPurchaseRequest = {
        ticketId: selectedTicket.id,
        phoneNumber: normalizedPhone,
        method: PaymentMethod.CASH,
      }
      const result = await apiClient.tickets.purchase(purchaseData)
      setPurchaseResult(result)
      notify.success('Ticket acheté avec succès!')
      logger.info('BuyTicket: achat cash réussi', { ticketId: selectedTicket.id })
      if (typeId) {
        const ticketsData = await apiClient.tickets.getByType(typeId)
        setTickets(ticketsData.filter((t) => t.status === 'available'))
      }
      setSelectedTicket(null)
      setPhoneNumber('')
    } catch (error: unknown) {
      logger.error('BuyTicket: achat cash échoué', error)
      const message = error instanceof Error ? error.message : "Erreur lors de l'achat du ticket"
      notify.error(message)
    } finally {
      setPurchasing(false)
      setPaymentHint(null)
    }
  }

  const handleKelpayInitiate = async () => {
    if (!selectedTicket || !phoneNumber.trim() || !user) {
      logger.warn('BuyTicket: Kelpay initié refusé, données manquantes')
      notify.error('Veuillez sélectionner un ticket et entrer votre numéro de téléphone')
      return
    }
    const phoneRegex = /^(\+243|0)[0-9]{9}$/
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      notify.error('Veuillez entrer un numéro de téléphone valide (ex: +243900000000 ou 0900000000)')
      return
    }
    const normalizedPhone = phoneNumber.replace(/\s/g, '')
    const amount = kelpayTypePriceCdf(ticketType)
    if (amount === undefined) {
      notify.error('Montant KELPAY indisponible (prix du forfait). Rechargez la page ou contactez l’administrateur.')
      return
    }

    logger.log('BuyTicket: Kelpay initiate', { ticketId: selectedTicket.id, amount })
    setKelpaySubmitting('init')
    setPaymentHint(null)
    try {
      const init = await apiClient.payments.initiateKelpay({
        ticketId: selectedTicket.id,
        phoneNumber: normalizedPhone,
        amount,
        userId: user.id,
      })
      setKelpaySession({ paymentId: init.paymentId, ticketId: selectedTicket.id })
      setKelpayReadyToConfirm(false)
      if (typeId) {
        writeKelpayPending({ paymentId: init.paymentId, ticketId: selectedTicket.id, typeId })
      }
      notify.success('Demande envoyée sur votre numéro. Validez avec votre code PIN quand vous voulez.')
      logger.info('BuyTicket: Kelpay initié', { paymentId: init.paymentId, status: init.status })
    } catch (error: unknown) {
      logger.error('BuyTicket: Kelpay initiate échoué', error)
      const message = error instanceof Error ? error.message : "Erreur lors de l'initiation du paiement"
      notify.error(message)
    } finally {
      setKelpaySubmitting(null)
    }
  }

  const handleKelpayVerify = async () => {
    if (!kelpaySession) return
    setKelpaySubmitting('verify')
    try {
      const verifyRes = await apiClient.payments.verifyKelpay(kelpaySession.paymentId)
      const payment = await apiClient.payments.getById(kelpaySession.paymentId)
      const st = String(payment.status)
      const rawFromVerify = kelpayVerifyPaymentStatusRaw(verifyRes)
      const rawForDecision = rawFromVerify !== '' ? rawFromVerify : st
      const decision = classifyKelpayVerifyDecision(rawForDecision)
      logger.debug('BuyTicket: Kelpay verify', { verifyRes, paymentStatusResource: st, rawFromVerify, decision })

      if (decision === 'failed') {
        if (st.toLowerCase() === 'expired') {
          notify.error('Le paiement a expiré. Réessayez ou choisissez un autre mode de paiement.')
        } else {
          notify.error('Le paiement a échoué ou a été annulé.')
        }
        await clearKelpaySessionAfterFailure()
        return
      }

      if (decision === 'unknown') {
        if (isKelpayPaymentSuccessStatus(st)) {
          await finalizeKelpaySuccess(kelpaySession.paymentId, kelpaySession.ticketId, payment)
          return
        }
        if (isKelpayPaymentFailureStatus(st)) {
          if (st.toLowerCase() === 'expired') {
            notify.error('Le paiement a expiré. Réessayez ou choisissez un autre mode de paiement.')
          } else {
            notify.error('Le paiement a échoué ou a été annulé.')
          }
          await clearKelpaySessionAfterFailure()
          return
        }
        setKelpayReadyToConfirm(false)
        notify.info(
          'Statut encore indéterminé',
          'Nous ne pouvons pas conclure pour l’instant. Réessayez « Vérifier » dans un moment après avoir terminé sur le téléphone.',
          { duration: 7000 },
        )
        return
      }

      // decision === 'success'
      if (isKelpayPaymentSuccessStatus(st)) {
        await finalizeKelpaySuccess(kelpaySession.paymentId, kelpaySession.ticketId, payment)
        return
      }

      const ready = kelpayVerifyReadyToConfirm(verifyRes)
      setKelpayReadyToConfirm(ready)
      if (ready) {
        notify.success('Paiement accepté. Dernière étape : confirmer pour activer votre accès Wi‑Fi.')
      } else {
        notify.info(
          'Finalisation pas encore prête',
          'Le statut est favorable mais la suite n’est pas disponible. Réessayez « Vérifier » ou patientez quelques instants.',
          { duration: 6500 },
        )
      }
    } catch (error: unknown) {
      logger.error('BuyTicket: Kelpay verify échoué', error)
      const message = error instanceof Error ? error.message : 'Erreur lors de la vérification'
      notify.error(message)
    } finally {
      setKelpaySubmitting(null)
    }
  }

  const handleKelpayConfirm = async () => {
    if (!kelpaySession) return
    setKelpaySubmitting('confirm')
    try {
      const confirmRes = await apiClient.payments.confirmKelpay(kelpaySession.paymentId)
      let finalPayment: Payment | undefined = confirmRes.payment
      if (!finalPayment) {
        finalPayment = await apiClient.payments.getById(kelpaySession.paymentId)
      }
      if (isKelpayPaymentFailureStatus(String(finalPayment.status))) {
        throw new Error('Le paiement a échoué.')
      }
      await finalizeKelpaySuccess(kelpaySession.paymentId, kelpaySession.ticketId, finalPayment)
      if (confirmRes.alreadyFinalized) {
        logger.info('BuyTicket: Kelpay confirm idempotent (déjà finalisé)', { paymentId: kelpaySession.paymentId })
      }
    } catch (error: unknown) {
      logger.error('BuyTicket: Kelpay confirm échoué', error)
      const message = error instanceof Error ? error.message : 'Erreur lors de la confirmation'
      const lower = message.toLowerCase()
      if (lower.includes('409') || lower.includes('conflict') || lower.includes('pas encore')) {
        notify.error('Kelpay n’a pas encore confirmé. Relancez « Vérifier » dans un moment.')
      } else {
        notify.error(message)
      }
    } finally {
      setKelpaySubmitting(null)
    }
  }

  const handleKelpayRefreshPaymentStatus = async () => {
    if (!kelpaySession) return
    setKelpaySubmitting('refresh')
    try {
      const payment = await apiClient.payments.getById(kelpaySession.paymentId)
      const st = String(payment.status)
      const decision = classifyKelpayVerifyDecision(st)
      logger.debug('BuyTicket: Kelpay refresh GET', { st, decision })

      if (decision === 'failed') {
        if (st.toLowerCase() === 'expired') {
          notify.error('Le paiement a expiré.')
        } else {
          notify.error('Le paiement a échoué ou a été annulé.')
        }
        await clearKelpaySessionAfterFailure()
        return
      }
      if (decision === 'success') {
        await finalizeKelpaySuccess(kelpaySession.paymentId, kelpaySession.ticketId, payment)
        return
      }
      setKelpayReadyToConfirm(false)
      notify.info(
        'Statut encore indéterminé',
        'Pas de décision fiable pour l’instant. Réessayez plus tard ou touchez « Vérifier ».',
        { duration: 6500 },
      )
    } catch (error: unknown) {
      logger.error('BuyTicket: refresh paiement échoué', error)
      notify.error(error instanceof Error ? error.message : 'Erreur lors du rafraîchissement')
    } finally {
      setKelpaySubmitting(null)
    }
  }

  const handleKelpayUserCancel = async () => {
    if (!kelpaySession) return
    if (
      !window.confirm(
        'Annuler cette demande de paiement Mobile Money ?\nLe ticket pourra redevenir disponible si le serveur accepte l’annulation (paiement encore en attente).'
      )
    ) {
      return
    }
    setKelpaySubmitting('cancel')
    try {
      const payment = await apiClient.payments.getById(kelpaySession.paymentId)
      const st = String(payment.status)
      if (!isKelpayPaymentPendingOrProcessing(st)) {
        notify.error(
          'Ce paiement n’est plus annulable depuis cet écran (déjà confirmé, échoué ou expiré). Consultez Mes paiements / Mes tickets.'
        )
        return
      }
      try {
        await apiClient.payments.cancelKelpay(kelpaySession.paymentId)
      } catch (cancelErr) {
        logger.warn('BuyTicket: cancelKelpay API indisponible ou erreur, tentative release ticket', cancelErr)
        await apiClient.tickets.release(kelpaySession.ticketId)
      }
      await clearKelpaySessionAfterFailure()
      notify.success('Demande annulée.')
      logger.info('BuyTicket: Kelpay annulé par l’utilisateur', { paymentId: kelpaySession.paymentId })
    } catch (error: unknown) {
      logger.error('BuyTicket: annulation Kelpay échouée', error)
      notify.error(error instanceof Error ? error.message : "Impossible d'annuler pour l'instant.")
    } finally {
      setKelpaySubmitting(null)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    logger.log('BuyTicket: copié dans presse-papier', { label })
    notify.success('Copié', `${label} est dans le presse-papier.`)
  }

  const formatPrice = (price: number | string | null | undefined) => {
    if (price === null || price === undefined) return 'Prix non renseigné'
    if (typeof price === 'number') {
      if (!Number.isFinite(price) || price < 0) return 'Prix non renseigné'
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'CDF',
        minimumFractionDigits: 0,
      }).format(price)
    }
    const s = String(price).trim().replace(/\s/g, '').replace(',', '.')
    if (s === '') return 'Prix non renseigné'
    const raw = Number(s)
    if (!Number.isFinite(raw) || raw < 0) return 'Prix non renseigné'
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0,
    }).format(raw)
  }

  const formatLimit = (limit?: string) => {
    if (!limit) return 'Illimité'
    return limit
  }

  if (authLoading || (!user && typeof window !== 'undefined')) {
    return <BuyTicketFallback />
  }

  if (purchaseResult) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-90" />
        <div className="pointer-events-none absolute left-1/4 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="relative z-10 w-full max-w-2xl animate-scale-in">
          <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl shadow-ink-950/30 backdrop-blur-xl sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="relative text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-600/30">
                <CheckCircle className="h-8 w-8" strokeWidth={2.25} />
              </div>
              <h1 className="font-display text-3xl font-bold text-ink-900">Achat réussi</h1>
              <p className="mt-2 text-ink-600">Voici vos identifiants de connexion Wi‑Fi</p>
            </div>

            <div className="relative mt-8 rounded-2xl border border-primary-100/80 bg-gradient-to-br from-primary-50/90 to-cyan-50/50 p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-primary-800">Identifiants</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="username-display" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Nom d&apos;utilisateur
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="username-display"
                      type="text"
                      readOnly
                      value={purchaseResult.credentials.username}
                      className="input flex-1 bg-white font-mono text-sm"
                      aria-label="Nom d'utilisateur"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(purchaseResult.credentials.username, "Nom d'utilisateur")}
                      className="btn btn-secondary px-4"
                      aria-label="Copier le nom d'utilisateur"
                      title="Copier le nom d'utilisateur"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="password-display" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Mot de passe
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="password-display"
                      type="text"
                      readOnly
                      value={purchaseResult.credentials.password}
                      className="input flex-1 bg-white font-mono text-sm"
                      aria-label="Mot de passe"
                    />
                    <button
                      type="button"
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
                  <label htmlFor="profile-display" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Profil
                  </label>
                  <input
                    id="profile-display"
                    type="text"
                    readOnly
                    value={purchaseResult.credentials.profile}
                    className="input bg-white"
                    aria-label="Profil"
                  />
                </div>
              </div>
            </div>

            <div className="relative mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
              <h3 className="mb-2 text-sm font-bold text-indigo-900">Instructions</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-indigo-900/90">
                {purchaseResult.credentials.instructions}
              </p>
            </div>

            <div className="relative mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setPurchaseResult(null)
                  setSelectedTicket(null)
                }}
                className="btn btn-secondary"
              >
                Acheter un autre ticket
              </button>
              <Link
                href="/my-tickets"
                className="btn btn-secondary inline-flex items-center justify-center gap-2 text-center"
              >
                <TicketIcon className="h-4 w-4 shrink-0" aria-hidden />
                Voir tous mes tickets
              </Link>
              <button
                type="button"
                onClick={() => {
                  const credentials = `${purchaseResult.credentials.username}\n${purchaseResult.credentials.password}`
                  copyToClipboard(credentials, 'Identifiants')
                }}
                className="btn btn-primary"
              >
                Copier les identifiants
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ——— Catalogue (sans ?type=) ——— */
  if (!typeId) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-ink-950">
        <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-95" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />

        <header className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow-sm">
                <Wifi className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">Acheter un ticket</h1>
                <p className="text-xs font-medium text-primary-200/90 sm:text-sm">Compte connecté · Club Internet Access</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20"
              >
                <LayoutDashboard className="h-4 w-4" />
                Tableau de bord
              </Link>
              <Link
                href="/my-tickets"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20"
              >
                <TicketIcon className="h-4 w-4" />
                Mes tickets
              </Link>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Choisissez votre{' '}
            <span className="bg-gradient-to-r from-primary-200 to-cyan-200 bg-clip-text text-transparent">forfait</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-primary-100/90 sm:text-lg">
            Tarifs selon le type (24h, 7 jours, 30 jours…). Sélectionnez un forfait pour afficher les tickets disponibles.
          </p>

          {loading ? (
            <div className="mx-auto mt-12 max-w-md rounded-3xl border border-white/15 bg-white/10 p-12 backdrop-blur-md">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-primary-300" />
              <p className="mt-4 text-sm font-medium text-primary-50">Chargement des forfaits…</p>
            </div>
          ) : catalogTypes.length === 0 ? (
            <div className="mx-auto mt-12 max-w-lg rounded-3xl border border-white/15 bg-white/10 p-12 backdrop-blur-md">
              <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-white/40" />
              <h3 className="font-display text-2xl font-bold text-white">Aucun forfait disponible</h3>
              <p className="mt-2 text-primary-100/85">Revenez plus tard ou contactez l&apos;administrateur.</p>
            </div>
          ) : (
            <div className="mx-auto mt-12 grid max-w-6xl gap-6 text-left md:grid-cols-2 lg:grid-cols-3">
              {catalogTypes.map((type, index) => (
                <div
                  key={type.id}
                  className={`group relative overflow-hidden rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl shadow-ink-950/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary-300/40 hover:shadow-glow opacity-0 animate-fade-in-up [animation-fill-mode:forwards] ${
                    index === 0
                      ? '[animation-delay:150ms]'
                      : index === 1
                        ? '[animation-delay:250ms]'
                        : index === 2
                          ? '[animation-delay:350ms]'
                          : '[animation-delay:450ms]'
                  }`}
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-400/15 blur-2xl transition-opacity group-hover:opacity-100" />
                  <div className="relative text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 text-white shadow-lg">
                      <Wifi className="h-7 w-7" strokeWidth={2.25} />
                    </div>
                    <h3 className="font-display text-xl font-bold text-ink-900">{type.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">{type.description}</p>
                    <p className="mt-4 font-display text-4xl font-bold text-gradient">{formatPrice(type.price)}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                      {type.availableCount} ticket{type.availableCount > 1 ? 's' : ''} en stock
                    </p>
                  </div>

                  <div className="relative mt-6 space-y-2.5 border-t border-ink-100 pt-6">
                    {type.timeLimit && (
                      <div className="flex items-center gap-2 text-sm text-ink-600">
                        <Clock className="h-4 w-4 shrink-0 text-primary-500" />
                        <span>
                          Durée : <strong className="text-ink-800">{formatLimit(type.timeLimit)}</strong>
                        </span>
                      </div>
                    )}
                    {type.dataLimit && (
                      <div className="flex items-center gap-2 text-sm text-ink-600">
                        <HardDrive className="h-4 w-4 shrink-0 text-primary-500" />
                        <span>
                          Données : <strong className="text-ink-800">{formatLimit(type.dataLimit)}</strong>
                        </span>
                      </div>
                    )}
                    {!type.timeLimit && !type.dataLimit && (
                      <p className="text-sm text-ink-600">
                        Durée et données <strong>illimitées</strong>
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/buy-ticket?type=${encodeURIComponent(type.id)}`)}
                    className="btn btn-primary group mt-8 w-full py-3.5"
                  >
                    Choisir ce forfait
                    <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ——— Détail par type (?type=) ——— */
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 px-4 py-10 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-95" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-primary-600/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push('/buy-ticket')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            ← Tous les forfaits
          </button>
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <Link href="/dashboard" className="text-primary-200 transition-colors hover:text-white">
              Tableau de bord
            </Link>
            <span className="text-white/30">·</span>
            <Link href="/my-tickets" className="text-primary-200 transition-colors hover:text-white">
              Mes tickets
            </Link>
          </div>
        </div>

        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md">
            <Wifi className="h-8 w-8 text-white" strokeWidth={2.25} />
          </div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
            {ticketType ? ticketType.name : 'Chargement…'}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-primary-100/90">
            {ticketType ? ticketType.description : 'Club Internet Access — Université de Kinshasa'}
          </p>
        </div>

        {loading ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-white/15 bg-white/95 p-12 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            <p className="mt-4 text-sm font-medium text-ink-600">Chargement des tickets disponibles…</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-white/15 bg-white/95 p-12 text-center shadow-2xl backdrop-blur-xl">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-ink-300" />
            <h2 className="font-display text-2xl font-bold text-ink-900">Aucun ticket disponible</h2>
            <p className="mt-2 text-ink-600">Il n&apos;y a plus de ticket en stock pour ce forfait.</p>
            <button type="button" onClick={() => router.push('/buy-ticket')} className="btn btn-primary mt-8">
              Retour au catalogue
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div
              className="rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl shadow-ink-950/15 backdrop-blur-xl animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
              style={{ animationDelay: '0.1s' }}
            >
              <h2 className="font-display text-lg font-bold text-ink-900">
                Tickets disponibles <span className="text-primary-600">({tickets.length})</span>
              </h2>
              <div className="mt-4 max-h-[600px] space-y-3 overflow-y-auto pr-1">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                      selectedTicket?.id === ticket.id
                        ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-cyan-50/80 shadow-md ring-2 ring-primary-500/20'
                        : 'border-ink-100 bg-white hover:border-primary-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-ink-900">{ticket.profile}</span>
                      <span className="font-display text-xl font-bold text-primary-600">
                        {formatPrice(effectiveUnitPrice(ticket, ticketType?.price))}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-500">
                      {ticket.timeLimit && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary-500" />
                          {formatLimit(ticket.timeLimit)}
                        </span>
                      )}
                      {ticket.dataLimit && (
                        <span className="inline-flex items-center gap-1">
                          <HardDrive className="h-3.5 w-3.5 text-primary-500" />
                          {formatLimit(ticket.dataLimit)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl shadow-ink-950/15 backdrop-blur-xl animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
              style={{ animationDelay: '0.2s' }}
            >
              <h2 className="font-display text-lg font-bold text-ink-900">Paiement</h2>

              {selectedTicket ? (
                <div className="mt-4 space-y-6">
                  <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/90 to-white p-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary-800">Récapitulatif</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between text-ink-600">
                        <span>Profil</span>
                        <span className="font-semibold text-ink-900">{selectedTicket.profile}</span>
                      </div>
                      {selectedTicket.timeLimit && (
                        <div className="flex justify-between text-ink-600">
                          <span>Durée</span>
                          <span className="font-medium text-ink-800">{formatLimit(selectedTicket.timeLimit)}</span>
                        </div>
                      )}
                      {selectedTicket.dataLimit && (
                        <div className="flex justify-between text-ink-600">
                          <span>Données</span>
                          <span className="font-medium text-ink-800">{formatLimit(selectedTicket.dataLimit)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-primary-100 pt-3">
                        <span className="font-bold text-ink-900">Total</span>
                        <span className="font-display text-lg font-bold text-primary-600">
                          {formatPrice(effectiveUnitPrice(selectedTicket, ticketType?.price))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Mode de paiement</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCheckoutMethod('kelpay')}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all ${
                          checkoutMethod === 'kelpay'
                            ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-cyan-50/80 shadow-md ring-2 ring-primary-500/20'
                            : 'border-ink-100 bg-white hover:border-primary-200'
                        }`}
                      >
                        <CreditCard className="h-6 w-6 text-primary-600" />
                        <span className="text-sm font-bold text-ink-900">Mobile Money</span>
                        <span className="text-[10px] font-medium leading-tight text-ink-500">
                          KELPAY · 3 étapes : demande → vérifier → confirmer (backend uniquement)
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckoutMethod('cash')}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all ${
                          checkoutMethod === 'cash'
                            ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-cyan-50/80 shadow-md ring-2 ring-primary-500/20'
                            : 'border-ink-100 bg-white hover:border-primary-200'
                        }`}
                      >
                        <Banknote className="h-6 w-6 text-primary-600" />
                        <span className="text-sm font-bold text-ink-900">Espèces</span>
                        <span className="text-[10px] font-medium leading-tight text-ink-500">Achat direct (caisse / point de vente)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Numéro de téléphone *
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
                    <p className="mt-1.5 text-xs text-ink-500">
                      {checkoutMethod === 'kelpay'
                        ? 'Numéro Mobile Money pour le débit KELPAY (+243… ou 09…).'
                        : 'Numéro de contact pour le reçu / la traçabilité.'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-ink-100 bg-ink-50/80 p-3">
                    <div className="flex items-start gap-2">
                      {checkoutMethod === 'kelpay' ? (
                        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                      ) : (
                        <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                      )}
                      <span className="text-sm font-semibold leading-snug text-ink-800">
                        {checkoutMethod === 'kelpay'
                          ? 'Le navigateur n’appelle jamais Kelpay directement : initiate → verify → confirm sur l’API, avec votre JWT. Pas de polling automatique côté serveur après initiate.'
                          : 'Achat enregistré comme espèces'}
                      </span>
                    </div>
                  </div>

                  {checkoutMethod === 'kelpay' && kelpaySession && (
                    <div className="space-y-3 rounded-2xl border border-primary-200 bg-primary-50/70 p-4 text-sm text-ink-800">
                      <p className="font-semibold text-ink-900">Demande Mobile Money envoyée</p>
                      <p>
                        Validez avec votre code PIN sur le téléphone quand vous voulez. Vous pouvez quitter cet écran :
                        l&apos;achat reste en attente jusqu&apos;à confirmation ou annulation côté paiement.
                      </p>
                      <p className="text-xs text-ink-600">
                        Si vous rafraîchissez la page, cette étape est mémorisée sur cet appareil (session du navigateur) : en
                        revenant sur le même forfait, vous retrouvez « Vérifier » / « Confirmer » tant que le paiement n&apos;est
                        pas terminé côté serveur.
                      </p>
                      <p className="break-all text-xs text-ink-500">
                        Paiement : <span className="font-mono">{kelpaySession.paymentId}</span>
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => void handleKelpayVerify()}
                          disabled={kelpaySubmitting !== null}
                          className="btn btn-secondary flex-1 py-3 text-sm disabled:opacity-50"
                        >
                          {kelpaySubmitting === 'verify' ? (
                            <span className="inline-flex items-center justify-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                              Vérification…
                            </span>
                          ) : (
                            <>J&apos;ai validé sur mon téléphone — vérifier</>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleKelpayRefreshPaymentStatus()}
                          disabled={kelpaySubmitting !== null}
                          className="btn btn-secondary flex-1 py-3 text-sm disabled:opacity-50"
                        >
                          {kelpaySubmitting === 'refresh' ? (
                            <span className="inline-flex items-center justify-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                              Actualisation…
                            </span>
                          ) : (
                            'Actualiser l’état du paiement'
                          )}
                        </button>
                      </div>
                      {kelpayReadyToConfirm && (
                        <button
                          type="button"
                          onClick={() => void handleKelpayConfirm()}
                          disabled={kelpaySubmitting !== null}
                          className="btn btn-primary w-full py-3.5 text-sm disabled:opacity-50"
                        >
                          {kelpaySubmitting === 'confirm' ? (
                            <span className="inline-flex items-center justify-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              Confirmation…
                            </span>
                          ) : (
                            'Confirmer et activer mon accès Wi‑Fi'
                          )}
                        </button>
                      )}
                      <div className="border-t border-primary-200/80 pt-3">
                        <button
                          type="button"
                          onClick={() => void handleKelpayUserCancel()}
                          disabled={kelpaySubmitting !== null}
                          className="btn w-full border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {kelpaySubmitting === 'cancel' ? (
                            <span className="inline-flex items-center justify-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                              Annulation…
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center gap-2">
                              <Ban className="h-4 w-4 shrink-0" />
                              Annuler cette demande (paiement en attente)
                            </span>
                          )}
                        </button>
                        <p className="mt-2 text-center text-[11px] text-ink-500">
                          Réservé tant que le flux n’est pas terminé : vous pouvez abandonner ici si le statut est encore{' '}
                          <strong>pending</strong> ou <strong>processing</strong> côté API.
                        </p>
                      </div>
                    </div>
                  )}

                  {!(checkoutMethod === 'kelpay' && kelpaySession) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (checkoutMethod === 'cash') void handleCashPurchase()
                        else void handleKelpayInitiate()
                      }}
                      disabled={
                        (checkoutMethod === 'cash' ? purchasing : kelpaySubmitting !== null) ||
                        !phoneNumber.trim()
                      }
                      className="btn btn-primary w-full py-3.5 text-base disabled:opacity-50"
                    >
                      {checkoutMethod === 'cash' && purchasing ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Traitement…
                        </span>
                      ) : checkoutMethod === 'kelpay' && kelpaySubmitting === 'init' ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Envoi de la demande…
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <ShoppingCart className="h-5 w-5" />
                          {checkoutMethod === 'kelpay'
                            ? 'Envoyer la demande sur mon téléphone'
                            : 'Confirmer l’achat (espèces)'}
                        </span>
                      )}
                    </button>
                  )}

                  {paymentHint && (
                    <p className="text-center text-xs font-medium text-primary-700">{paymentHint}</p>
                  )}

                  <p className="text-center text-[11px] text-ink-400">
                    En achetant, vous acceptez nos conditions d&apos;utilisation.
                  </p>
                </div>
              ) : (
                <div className="mt-10 py-8 text-center text-ink-500">
                  <ShoppingCart className="mx-auto mb-3 h-12 w-12 opacity-40" />
                  <p className="text-sm font-medium">Sélectionnez un ticket à gauche pour continuer</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BuyTicketPage() {
  return (
    <Suspense fallback={<BuyTicketFallback />}>
      <BuyTicketContent />
    </Suspense>
  )
}
