'use client'

import { useEffect, useState } from 'react'
import { dashboardService } from '@/services/api'
import { apiClient } from '@/lib/api-client'
import { Ticket as TicketIcon, DollarSign, ShoppingCart, Package } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { notify } from '@/lib/notify'
import type { DashboardStats, ChartData } from '@/types/api'

type TicketAdminStats = {
  total: number
  available: number
  sold: number
  reserved: number
  revenue: number
}

export default function DashboardAdmin() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [charts, setCharts] = useState<ChartData | null>(null)
  const [ticketStats, setTicketStats] = useState<TicketAdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsData, chartsData, ticketsData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getCharts(7),
        apiClient.admin.tickets.getStats().catch(() => null),
      ])
      setStats(statsData)
      setCharts(chartsData)
      setTicketStats(ticketsData)
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
        <button type="button" onClick={loadData} className="btn btn-secondary shrink-0 self-start sm:self-auto">
          Actualiser
        </button>
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
            <div className="p-3 bg-blue-100 rounded-full transition-transform duration-300 hover:scale-110">
              <Package className="h-6 w-6 text-blue-600" />
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
            <div className="p-3 bg-indigo-100 rounded-full transition-transform duration-300 hover:scale-110">
              <TicketIcon className="h-6 w-6 text-indigo-600" />
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
              <p className="text-xs text-green-600 mt-1">
                {`${stats.payments.completed} paiement${stats.payments.completed !== 1 ? 's' : ''} complété${stats.payments.completed !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full transition-transform duration-300 hover:scale-110">
              <DollarSign className="h-6 w-6 text-green-600" />
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
            <div className="p-3 bg-emerald-100 rounded-full transition-transform duration-300 hover:scale-110">
              <ShoppingCart className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card opacity-0 animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
          <h2 className="font-display text-lg font-bold text-ink-900">Paiements</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Total</span>
              <span className="font-semibold">{stats.payments.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Complétés</span>
              <span className="text-green-600 font-semibold">{stats.payments.completed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">En attente</span>
              <span className="text-yellow-600 font-semibold">{stats.payments.pending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Échoués</span>
              <span className="text-red-600 font-semibold">{stats.payments.failed}</span>
            </div>
            <div className="pt-3 border-t border-ink-100">
              <div className="flex justify-between items-center">
                <span className="text-ink-900 font-semibold">Revenus</span>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(stats.payments.revenue)}
                </span>
              </div>
            </div>
          </div>
        </div>
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
                stroke="#10b981"
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
