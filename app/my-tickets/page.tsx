'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, HardDrive, ShoppingCart, LayoutDashboard, Ticket as TicketIcon, Copy } from 'lucide-react'
import { notify } from '@/lib/notify'
import { useAuth } from '@/contexts/AuthContext'
import type { Ticket } from '@/types/api'
import { TicketStatus } from '@/types/api'
import { apiClient } from '@/lib/api-client'
import { parseApiDecimal } from '@/lib/normalize-ticket-api'
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
        const data = await apiClient.tickets.mine()
        setTickets(data)
        logger.info('MyTickets: tickets chargés', { count: data.length })
      } catch (error: unknown) {
        logger.error('MyTickets: erreur chargement tickets', error)
        notify.error(
          'Impossible d’afficher vos tickets',
          'Vérifiez votre connexion ou reconnectez-vous, puis actualisez la page.',
        )
      } finally {
        setLoading(false)
      }
    }

    fetchTickets()
  }, [user, authLoading, router])

  const formatPrice = (price: number | string | null | undefined) => {
    const n = parseApiDecimal(price)
    if (!Number.isFinite(n) || n < 0) {
      return 'Prix non renseigné'
    }
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0,
    }).format(n)
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    notify.success('Copié', `${label} est dans le presse-papier.`)
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950">
        <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-90" />
        <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-primary-300" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-95" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[28rem] -translate-x-1/2 rounded-full bg-primary-500/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <header className="mb-10 flex flex-col gap-4 border-b border-white/10 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow-sm">
              <TicketIcon className="h-7 w-7" strokeWidth={2.25} />
            </span>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Mes tickets</h1>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-primary-100/90 sm:text-base">
                Historique de vos achats et codes de connexion Wi‑Fi.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <LayoutDashboard className="h-4 w-4" />
              Tableau de bord
            </Link>
            <Link
              href="/buy-ticket"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-900/30 transition-transform hover:scale-[1.02]"
            >
              <ShoppingCart className="h-4 w-4" />
              Acheter
            </Link>
          </div>
        </header>

        <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-primary-50">
              <div className="mb-4 h-11 w-11 animate-spin rounded-full border-2 border-white/20 border-t-primary-300" />
              <p className="text-sm font-medium">Chargement de vos tickets…</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 py-16 text-center">
              <ShoppingCart className="mb-4 h-14 w-14 text-white/40" />
              <h2 className="font-display text-xl font-bold text-white">Aucun ticket</h2>
              <p className="mt-2 max-w-md text-sm text-primary-100/85">
                Vous n&apos;avez pas encore acheté de ticket avec ce compte.
              </p>
              <button type="button" onClick={() => router.push('/buy-ticket')} className="btn btn-primary mt-8 px-8">
                Découvrir les forfaits
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/95 p-5 shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-300/40 hover:shadow-glow-sm"
                >
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-400/10 blur-2xl transition-opacity group-hover:opacity-100" />
                  <div className="relative flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-bold text-ink-900">{ticket.profile}</h3>
                      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">
                        Réf. {ticket.id.slice(0, 8)}…
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        ticket.status === TicketStatus.SOLD
                          ? 'bg-emerald-100 text-emerald-800'
                          : ticket.status === TicketStatus.EXPIRED
                            ? 'bg-rose-100 text-rose-800'
                            : ticket.status === TicketStatus.RESERVED
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-ink-100 text-ink-700'
                      }`}
                    >
                      {formatStatus(ticket.status)}
                    </span>
                  </div>

                  <div className="relative mt-4 flex flex-wrap gap-3 text-xs text-ink-600">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink-50 px-2 py-1">
                      <Clock className="h-3.5 w-3.5 text-primary-600" />
                      {ticket.timeLimit ? ticket.timeLimit : 'Illimité'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink-50 px-2 py-1">
                      <HardDrive className="h-3.5 w-3.5 text-primary-600" />
                      {ticket.dataLimit ? ticket.dataLimit : 'Illimité'}
                    </span>
                  </div>

                  <div className="relative mt-4 border-t border-ink-100 pt-4">
                    <p className="font-display text-xl font-bold text-gradient">{formatPrice(ticket.price)}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      Acheté le {formatDateTime(ticket.soldAt || ticket.createdAt)}
                    </p>
                  </div>

                  <div className="relative mt-3 space-y-3">
                    <div className="rounded-xl bg-ink-900/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Identifiant</p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(ticket.username, "Nom d'utilisateur")}
                          className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-white/80 hover:text-primary-600"
                          title="Copier le nom d'utilisateur"
                          aria-label="Copier le nom d'utilisateur"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 break-all font-mono text-sm font-semibold text-ink-900">{ticket.username}</p>
                    </div>
                    <div className="rounded-xl bg-ink-900/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Mot de passe</p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(ticket.password || '', 'Mot de passe')}
                          disabled={!ticket.password}
                          className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-white/80 hover:text-primary-600 disabled:pointer-events-none disabled:opacity-30"
                          title="Copier le mot de passe"
                          aria-label="Copier le mot de passe"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 break-all font-mono text-sm font-semibold text-ink-900">
                        {ticket.password?.trim() ? ticket.password : '—'}
                      </p>
                    </div>
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
