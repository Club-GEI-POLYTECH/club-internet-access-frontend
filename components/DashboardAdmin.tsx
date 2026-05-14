'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { dashboardService } from '@/services/api'
import { apiClient } from '@/lib/api-client'
import { Ticket as TicketIcon, DollarSign, ShoppingCart, Package, Users, UserRound, LayoutList } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { notify } from '@/lib/notify'
import type { DashboardStats, ChartData, TicketType, AdminTicketsStats } from '@/types/api'

type TypeBreakdownRow = {
  typeId: string
  label: string
  profile: string
  remaining: number
  sold: number | null
  totalType: number | null
}

/** Fusionne `GET /tickets/types` et stats admin (`byType`, `soldCount`, `totalCount`…). */
function buildTicketTypeBreakdown(types: TicketType[], stats: AdminTicketsStats | null): TypeBreakdownRow[] {
  const byStats = stats?.byType ?? []
  const byId = new Map(byStats.map((r) => [r.ticketTypeId, r]))

  if (types.length === 0 && byStats.length > 0) {
    return byStats.map((st) => {
      const remaining = st.available
      const sold = st.sold
      const reserved = st.reserved ?? 0
      const totalType = st.total !== undefined && st.total > 0 ? st.total : remaining + sold + reserved
      return {
        typeId: st.ticketTypeId,
        label: st.name ?? '—',
        profile: '',
        remaining,
        sold,
        totalType: totalType > 0 ? totalType : null,
      }
    })
  }

  return types.map((t) => {
    const st = byId.get(t.id)
    const remaining = st?.available ?? t.availableCount
    let sold: number | null = st?.sold ?? t.soldCount ?? null
    const reserved = st?.reserved ?? t.reservedCount ?? 0
    if (sold == null && typeof t.totalCount === 'number' && t.totalCount >= 0) {
      const derived = t.totalCount - remaining - reserved
      sold = derived >= 0 ? derived : null
    }
    let totalType: number | null = st?.total ?? t.totalCount ?? null
    if (totalType == null && sold != null) {
      totalType = remaining + sold + reserved
    }
    return {
      typeId: t.id,
      label: t.name,
      profile: t.profile,
      remaining,
      sold,
      totalType,
    }
  })
}

export default function DashboardAdmin() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [charts, setCharts] = useState<ChartData | null>(null)
  const [ticketStats, setTicketStats] = useState<AdminTicketsStats | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsData, chartsData, ticketsData, typesData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getCharts(7),
        apiClient.admin.tickets.getStats().catch(() => null),
        apiClient.tickets.getTypes().catch(() => [] as TicketType[]),
      ])
      setStats(statsData)
      setCharts(chartsData)
      setTicketStats(ticketsData)
      setTicketTypes(Array.isArray(typesData) ? typesData : [])
    } catch (error: unknown) {
      notify.error('Tableau de bord indisponible', 'Impossible de charger les statistiques. Réessayez dans un instant.')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const breakdownRows = useMemo(() => {
    const active = ticketTypes.filter((t) => t.isActive !== false)
    const pool = active.length > 0 ? active : ticketTypes
    return buildTicketTypeBreakdown(pool, ticketStats)
  }, [ticketTypes, ticketStats])

  const sumRemainingByType = useMemo(
    () => breakdownRows.reduce((s, r) => s + r.remaining, 0),
    [breakdownRows],
  )

  const sumSoldByType = useMemo(() => {
    if (breakdownRows.length === 0) return null
    if (!breakdownRows.every((r) => r.sold != null)) return null
    return breakdownRows.reduce((s, r) => s + (r.sold ?? 0), 0)
  }, [breakdownRows])

  const sumTotalByType = useMemo(() => {
    if (breakdownRows.length === 0) return null
    if (!breakdownRows.every((r) => r.totalType != null)) return null
    return breakdownRows.reduce((s, r) => s + (r.totalType ?? 0), 0)
  }, [breakdownRows])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 animate-fade-in-down sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Vue d&apos;ensemble</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
            Vente de tickets
          </h1>
          <p className="mt-2 max-w-xl text-ink-600">Stocks, ventes et paiements en un coup d&apos;œil.</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Link href="/profile" className="btn btn-secondary inline-flex shrink-0 items-center gap-2">
            <UserRound className="h-4 w-4" />
            Mon profil
          </Link>
          <button type="button" onClick={loadData} className="btn btn-secondary shrink-0">
            Actualiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card opacity-0 animate-fade-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Tickets en stock</p>
              <p className="font-display text-2xl font-bold text-ink-900">
                {ticketStats != null ? ticketStats.available : '—'}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {ticketStats != null ? `${ticketStats.total} au total` : 'Stats tickets indisponibles'}
              </p>
            </div>
            <div className="rounded-full bg-primary-100 p-3 transition-transform duration-300 hover:scale-110">
              <Package className="h-6 w-6 text-primary-700" />
            </div>
          </div>
        </div>

        <div className="card opacity-0 animate-fade-in-up" style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Tickets vendus</p>
              <p className="font-display text-2xl font-bold text-ink-900">
                {ticketStats != null ? ticketStats.sold : '—'}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {ticketStats != null && ticketStats.reserved > 0
                  ? `${ticketStats.reserved} réservé(s)`
                  : ' '}
              </p>
            </div>
            <div className="rounded-full bg-primary-50 p-3 transition-transform duration-300 hover:scale-110">
              <TicketIcon className="h-6 w-6 text-primary-700" />
            </div>
          </div>
        </div>

        <div className="card opacity-0 animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Revenus (paiements)</p>
              <p className="font-display text-2xl font-bold text-ink-900">
                {formatCurrency(stats.payments.revenue)}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {`${stats.payments.completed} paiement${stats.payments.completed !== 1 ? 's' : ''} complété${stats.payments.completed !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3 transition-transform duration-300 hover:scale-110">
              <DollarSign className="h-6 w-6 text-emerald-700" />
            </div>
          </div>
        </div>

        <div className="card opacity-0 animate-fade-in-up" style={{ animationDelay: '0.25s', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">Revenus tickets (admin)</p>
              <p className="font-display text-2xl font-bold text-ink-900">
                {ticketStats != null ? formatCurrency(ticketStats.revenue) : '—'}
              </p>
              <p className="mt-1 text-xs text-ink-500">Si exposé par le backend</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3 transition-transform duration-300 hover:scale-110">
              <ShoppingCart className="h-6 w-6 text-emerald-700" />
            </div>
          </div>
        </div>
      </div>

      <div className="card opacity-0 animate-fade-in-up" style={{ animationDelay: '0.27s', animationFillMode: 'forwards' }}>
        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
            <LayoutList className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">Stocks et ventes par type de ticket</h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-600">
              <strong>Restants</strong> par ligne : catalogue{' '}
              <code className="rounded bg-ink-100 px-1 text-xs">GET /tickets/types</code> (champ{' '}
              <code className="rounded bg-ink-100 px-1 text-xs">availableCount</code>). <strong>Vendus</strong> par type
              si l’API renvoie <code className="rounded bg-ink-100 px-1 text-xs">byType</code> sur les stats admin, ou{' '}
              <code className="rounded bg-ink-100 px-1 text-xs">soldCount</code> / <code className="rounded bg-ink-100 px-1 text-xs">totalCount</code> sur
              chaque type — sinon affichage <span className="font-medium">—</span>. Les totaux globaux viennent toujours de{' '}
              <code className="rounded bg-ink-100 px-1 text-xs">GET /admin/tickets/stats</code> lorsqu’il est disponible.
            </p>
          </div>
        </div>
        {breakdownRows.length === 0 ? (
          <p className="text-sm text-ink-500">Aucun type de ticket dans le catalogue.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-ink-200">
              <table className="w-full min-w-[520px] text-left text-sm">
                <caption className="sr-only">
                  Répartition par type : tickets restants, vendus et total par type, puis totaux
                </caption>
                <thead className="border-b border-ink-200 bg-ink-50/90 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Restants
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Vendus
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total (type)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {breakdownRows.map((row) => (
                    <tr key={row.typeId} className="hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <span className="font-medium text-ink-900">{row.label}</span>
                        {row.profile ? <span className="mt-0.5 block text-xs text-ink-500">{row.profile}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-900">{row.remaining}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-900">{row.sold != null ? row.sold : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-800">{row.totalType != null ? row.totalType : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-ink-200 bg-primary-50/50">
                  <tr className="text-sm font-semibold text-ink-900">
                    <td className="px-4 py-3">Totaux (somme des lignes)</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sumRemainingByType}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sumSoldByType != null ? sumSoldByType : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sumTotalByType != null ? sumTotalByType : '—'}</td>
                  </tr>
                  {ticketStats != null ? (
                    <tr className="border-t border-ink-200 text-xs font-normal text-ink-600">
                      <td className="px-4 py-2.5" colSpan={2}>
                        Totaux globaux (API admin)
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums" colSpan={2}>
                        Restants : {ticketStats.available} · Vendus : {ticketStats.sold} · Total tickets : {ticketStats.total}
                        {ticketStats.reserved > 0 ? ` · Réservés : ${ticketStats.reserved}` : ''}
                      </td>
                    </tr>
                  ) : null}
                </tfoot>
              </table>
            </div>
            {ticketStats != null && sumRemainingByType !== ticketStats.available ? (
              <p className="mt-2 text-xs text-amber-800">
                La somme des restants par type ({sumRemainingByType}) diffère du total « disponible » de l’API (
                {ticketStats.available}). Vérifiez la cohérence côté backend ou les types inactifs.
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card opacity-0 animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
          <h2 className="font-display text-lg font-bold text-ink-900">Paiements</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Total</span>
              <span className="font-semibold text-ink-900">{stats.payments.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Complétés</span>
              <span className="font-semibold text-emerald-700">{stats.payments.completed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">En attente</span>
              <span className="font-semibold text-amber-700">{stats.payments.pending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Échoués</span>
              <span className="font-semibold text-rose-700">{stats.payments.failed}</span>
            </div>
            <div className="border-t border-ink-100 pt-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-ink-900">Revenus</span>
                <span className="text-xl font-bold text-emerald-700">
                  {formatCurrency(stats.payments.revenue)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card flex flex-col gap-4 opacity-0 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: '0.28s', animationFillMode: 'forwards' }}>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary-100 p-3 text-primary-700">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">Utilisateurs de la plateforme</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-600">
              Liste, création, modification et suppression des comptes (agents, étudiants, etc.) via l’API.
            </p>
          </div>
        </div>
        <Link href="/admin/users" className="btn btn-primary shrink-0 self-start sm:self-center">
          Gérer les utilisateurs
        </Link>
      </div>

      {charts && (
        <div className="card opacity-0 animate-fade-in-up" style={{ animationDelay: '0.35s', animationFillMode: 'forwards' }}>
          <h2 className="font-display text-lg font-bold text-ink-900">Revenus (7 derniers jours)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={charts.payments}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => new Date(label).toLocaleDateString('fr-FR')}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#0891b2"
                strokeWidth={2}
                name="Revenus (CDF)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
