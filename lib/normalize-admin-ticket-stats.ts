import type { AdminTicketsStats, AdminTicketTypeStatRow } from '@/types/api'
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

function normalizeByTypeRow(item: unknown): AdminTicketTypeStatRow | null {
  const t = asRecord(item)
  const id = String(t.ticketTypeId ?? t.typeId ?? t.id ?? t.ticket_type_id ?? '').trim()
  if (!id) return null
  const reserved = pickInt(t, 'reserved', 'reservedCount', 'reserved_count')
  const total = pickInt(t, 'total', 'totalCount', 'total_count')
  return {
    ticketTypeId: id,
    name: t.name != null ? String(t.name) : undefined,
    available: pickInt(t, 'available', 'availableCount', 'available_count'),
    sold: pickInt(t, 'sold', 'soldCount', 'sold_count'),
    ...(reserved > 0 ? { reserved } : {}),
    ...(total > 0 ? { total } : {}),
  }
}

/** Normalise la réponse de `GET /admin/tickets/stats` (formes plates ou `{ data }`, `byType` / snake_case). */
export function normalizeAdminTicketsStats(raw: unknown): AdminTicketsStats {
  const root = asRecord(raw)
  const data = asRecord(root.data ?? raw)

  const byTypeRaw = data.byType ?? data.by_type ?? data.perType ?? data.per_type ?? data.typesStats ?? data.types_stats
  let byType: AdminTicketTypeStatRow[] | undefined
  if (Array.isArray(byTypeRaw)) {
    const rows = byTypeRaw.map(normalizeByTypeRow).filter((r): r is AdminTicketTypeStatRow => r != null)
    if (rows.length > 0) byType = rows
  }

  return {
    total: pickInt(data, 'total', 'Total'),
    available: pickInt(data, 'available', 'availableCount', 'available_count'),
    sold: pickInt(data, 'sold', 'soldCount', 'sold_count'),
    reserved: pickInt(data, 'reserved', 'reservedCount', 'reserved_count'),
    revenue: pickRevenue(data, 'revenue', 'totalRevenue', 'total_revenue'),
    byType,
  }
}
