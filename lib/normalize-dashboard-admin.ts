import type { AdminDashboardPayments, AdminTicketsStats } from '@/types/api'
import { normalizeAdminTicketsStats } from '@/lib/normalize-admin-ticket-stats'
import { parseApiDecimal, parseApiInt } from '@/lib/normalize-ticket-api'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function pickInt(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    if (!(k in obj)) continue
    return parseApiInt(obj[k])
  }
  return 0
}

function pickRevenue(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    if (!(k in obj)) continue
    const n = parseApiDecimal(obj[k])
    if (Number.isFinite(n)) return n
  }
  return 0
}

/** Normalise `GET /dashboard/stats` (admin) : paiements + bloc tickets avec `byTicketType`. */
export function normalizeAdminDashboardStats(raw: unknown): {
  payments: AdminDashboardPayments
  ticketStats: AdminTicketsStats | null
} {
  const root = asRecord(raw)
  const data = asRecord(root.data ?? raw)

  const paymentsRaw = asRecord(data.payments)
  const payments: AdminDashboardPayments = {
    total: pickInt(paymentsRaw, 'total'),
    completed: pickInt(paymentsRaw, 'completed'),
    pending: pickInt(paymentsRaw, 'pending'),
    failed: pickInt(paymentsRaw, 'failed'),
    revenue: pickRevenue(paymentsRaw, 'revenue'),
  }

  const ticketsRaw = data.tickets
  const ticketStats =
    ticketsRaw != null && typeof ticketsRaw === 'object'
      ? normalizeAdminTicketsStats(ticketsRaw)
      : null

  return { payments, ticketStats }
}
