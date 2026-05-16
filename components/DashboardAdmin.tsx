'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { dashboardService } from '@/services/api'
import { apiClient } from '@/lib/api-client'
import { Ticket as TicketIcon, DollarSign, ShoppingCart, Package, Users, UserRound, LayoutList } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { notify } from '@/lib/notify'
import { formatTicketTypeSubtitle } from '@/lib/user-messages'
import { normalizeAdminDashboardStats } from '@/lib/normalize-dashboard-admin'
import type { AdminDashboardPayments, ChartData, TicketType, AdminTicketsStats } from '@/types/api'

type TypeBreakdownRow = {
  typeId: string
  label: string
  subtitle: string | null
  remaining: number
  sold: number | null
  totalType: number | null
}

/** Priorité aux stats par forfait (`byTicketType` / `byType`), puis au catalogue des types. */
function buildTicketTypeBreakdown(types: TicketType[], stats: AdminTicketsStats | null): TypeBreakdownRow[] {
  const byStats = stats?.byType ?? []
  const typesById = new Map(types.map((t) => [t.id, t]))

  if (byStats.length > 0) {
    return [...byStats]
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr'))
      .map((st) => {
        const t = typesById.get(st.ticketTypeId)
        const remaining = st.available
        const sold = st.sold
        const reserved = st.reserved ?? 0
        const totalType =
          st.total != null && st.total > 0 ? st.total : remaining + sold + reserved
        return {
          typeId: st.ticketTypeId,
          label: st.name ?? t?.name ?? 'Forfait',
          subtitle: formatTicketTypeSubtitle(
            t ?? { profile: st.profile, timeLimit: st.timeLimit, dataLimit: st.dataLimit },
          ),
          remaining,
          sold,
          totalType: totalType > 0 ? totalType : null,
        }
      })
  }

  const byId = new Map(byStats.map((r) => [r.ticketTypeId, r]))

  return types.map((t) => {
    const st = byId.get(t.id)
    const remaining = st?.available ?? t.availableCount
    const reserved = st?.reserved ?? t.reservedCount ?? 0
    let sold: number | null = st?.sold ?? t.soldCount ?? null
    let totalType: number | null = st?.total ?? t.totalCount ?? null
    if (sold == null && totalType != null && totalType > 0) {
      const derived = totalType - remaining - reserved
      sold = derived >= 0 ? derived : null
    }
    if (sold == null && typeof t.totalCount === 'number' && t.totalCount >= 0) {
      const derived = t.totalCount - remaining - reserved
      sold = derived >= 0 ? derived : null
    }
    if (totalType == null && sold != null) {
      totalType = remaining + sold + reserved
    }
    return {
      typeId: t.id,
      label: t.name,
      subtitle: formatTicketTypeSubtitle(t),
      remaining,
      sold,
      totalType: totalType != null && totalType > 0 ? totalType : null,
    }
  })
}

export default function DashboardAdmin() {
  const [payments, setPayments] = useState<AdminDashboardPayments | null>(null)
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
      const [rawStats, chartsData, typesData, fallbackTicketStats] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getCharts(7),
        apiClient.tickets.getTypes().catch(() => [] as TicketType[]),
        apiClient.admin.tickets.getStats().catch(() => null),
      ])
      const { payments: paymentsBlock, ticketStats: fromDashboard } = normalizeAdminDashboardStats(rawStats)
      setPayments(paymentsBlock)
      setCharts(chartsData)
      const ticketStatsMerged =
        fromDashboard?.byType?.length
          ? fromDashboard
          : fromDashboard && fallbackTicketStats?.byType?.length
            ? { ...fromDashboard, byType: fallbackTicketStats.byType }
            : (fromDashboard ?? fallbackTicketStats)
      setTicketStats(ticketStatsMerged)
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

  const hasPerTypeSoldDetail = breakdownRows.length > 0 && breakdownRows.every((r) => r.sold != null)

  const totalsAlignWithCatalog =
    ticketStats != null &&
    hasPerTypeSoldDetail &&
    sumSoldByType != null &&
    sumTotalByType != null &&
    sumRemainingByType === ticketStats.available &&
    sumSoldByType === ticketStats.sold &&
    sumTotalByType === ticketStats.total

  const globalPartsMatch =
    ticketStats != null &&
    ticketStats.available + ticketStats.sold + ticketStats.reserved === ticketStats.total

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!payments) return null

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
                {formatCurrency(payments.revenue)}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {`${payments.completed} paiement${payments.completed !== 1 ? 's' : ''} complété${payments.completed !== 1 ? 's' : ''}`}
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
              <p className="mt-1 text-xs text-ink-500">Selon les données disponibles</p>
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
              <strong>Restants</strong> : forfaits encore disponibles à la vente. <strong>Vendus</strong> : forfaits déjà
              achetés. <strong>Total</strong> : ensemble des forfaits de ce type (restants + vendus + réservés le cas
              échéant).
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
                        {row.subtitle ? <span className="mt-0.5 block text-xs text-ink-500">{row.subtitle}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-900">{row.remaining}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-900">{row.sold != null ? row.sold : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-800">{row.totalType != null ? row.totalType : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-ink-200 bg-primary-50/50">
                  {!hasPerTypeSoldDetail ? (
                    <tr className="text-xs text-ink-600">
                      <td className="px-4 py-2.5" colSpan={4}>
                        Détail par forfait indisponible ligne par ligne. Seuls les totaux catalogue sont affichés
                        ci-dessous.
                      </td>
                    </tr>
                  ) : null}
                  {ticketStats != null ? (
                    totalsAlignWithCatalog || !hasPerTypeSoldDetail ? (
                      <tr className="text-sm font-semibold text-ink-900">
                        <td className="px-4 py-3">Totaux</td>
                        <td className="px-4 py-3 text-right tabular-nums">{ticketStats.available}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{ticketStats.sold}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{ticketStats.total}</td>
                      </tr>
                    ) : (
                      <>
                        <tr className="text-sm font-semibold text-ink-900">
                          <td className="px-4 py-3">Totaux (somme des lignes)</td>
                          <td className="px-4 py-3 text-right tabular-nums">{sumRemainingByType}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{sumSoldByType}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{sumTotalByType}</td>
                        </tr>
                        <tr className="border-t border-ink-200 text-sm font-semibold text-ink-900">
                          <td className="px-4 py-3">Totaux catalogue</td>
                          <td className="px-4 py-3 text-right tabular-nums">{ticketStats.available}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{ticketStats.sold}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{ticketStats.total}</td>
                        </tr>
                      </>
                    )
                  ) : hasPerTypeSoldDetail ? (
                    <tr className="text-sm font-semibold text-ink-900">
                      <td className="px-4 py-3">Totaux</td>
                      <td className="px-4 py-3 text-right tabular-nums">{sumRemainingByType}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{sumSoldByType}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{sumTotalByType}</td>
                    </tr>
                  ) : null}
                  {ticketStats != null && ticketStats.reserved > 0 ? (
                    <tr className="text-xs text-ink-600">
                      <td className="px-4 py-2.5" colSpan={4}>
                        {ticketStats.reserved === 1
                          ? '1 forfait est réservé (paiement en cours) : il est inclus dans le total mais pas dans les restants.'
                          : `${ticketStats.reserved} forfaits sont réservés (paiements en cours) : ils sont inclus dans le total mais pas dans les restants.`}
                        {globalPartsMatch
                          ? ` Total = restants (${ticketStats.available}) + vendus (${ticketStats.sold}) + réservés (${ticketStats.reserved}).`
                          : null}
                      </td>
                    </tr>
                  ) : null}
                </tfoot>
              </table>
            </div>
            {ticketStats != null && hasPerTypeSoldDetail && !totalsAlignWithCatalog ? (
              <p className="mt-2 text-xs text-amber-800">
                La somme des lignes (restants {sumRemainingByType}, vendus {sumSoldByType}, total {sumTotalByType})
                ne correspond pas aux totaux catalogue (restants {ticketStats.available}, vendus {ticketStats.sold},
                total {ticketStats.total}). Vérifiez les forfaits inactifs ou contactez le support technique.
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
              <span className="font-semibold text-ink-900">{payments.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Complétés</span>
              <span className="font-semibold text-emerald-700">{payments.completed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">En attente</span>
              <span className="font-semibold text-amber-700">{payments.pending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Échoués</span>
              <span className="font-semibold text-rose-700">{payments.failed}</span>
            </div>
            <div className="border-t border-ink-100 pt-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-ink-900">Revenus</span>
                <span className="text-xl font-bold text-emerald-700">
                  {formatCurrency(payments.revenue)}
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
              Gérez les comptes agents et étudiants de la plateforme.
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
