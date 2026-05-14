import type { Ticket, TicketType } from '@/types/api'

/** Où l’API peut exposer le prix d’un ticket (champ direct, snake_case, ou type embarqué). */
function ticketPriceRawFromApi(raw: Ticket): unknown {
  const r = raw as unknown as Record<string, unknown>
  if (r.price !== undefined && r.price !== null) return r.price
  if (r.salePrice !== undefined && r.salePrice !== null) return r.salePrice
  if (r.unitPrice !== undefined && r.unitPrice !== null) return r.unitPrice
  if (r.sale_price !== undefined && r.sale_price !== null) return r.sale_price
  if (r.unit_price !== undefined && r.unit_price !== null) return r.unit_price
  for (const key of ['ticketType', 'ticket_type'] as const) {
    const tt = r[key]
    if (tt && typeof tt === 'object') {
      const tto = tt as Record<string, unknown>
      if (tto.price !== undefined && tto.price !== null) return tto.price
    }
  }
  return r.price
}

/** Décimal API (ex. `"1500.00"`, `1500`, nombre Prisma sérialisé en string). */
export function parseApiDecimal(value: unknown): number {
  if (value === null || value === undefined) return NaN
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const s = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')
  // Number('') === 0 en JS : sans ce garde-fou, un prix absent devient 0 CDF.
  if (s === '') return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export function parseApiInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  const n = parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(n) ? n : 0
}

function parseOptionalApiInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  const s = String(value).trim()
  if (s === '') return undefined
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : undefined
}

export function normalizeTicketType(raw: TicketType): TicketType {
  const r = raw as unknown as Record<string, unknown>
  const price = parseApiDecimal(r.price)
  const availableCount = parseApiInt(r.availableCount ?? r.available_count)
  const soldCount = parseOptionalApiInt(r.soldCount ?? r.sold_count)
  const totalCount = parseOptionalApiInt(r.totalCount ?? r.total_count ?? r.ticketsCount ?? r.tickets_count)
  const reservedCount = parseOptionalApiInt(r.reservedCount ?? r.reserved_count)
  return {
    ...raw,
    price: Number.isFinite(price) ? price : NaN,
    availableCount,
    ...(soldCount !== undefined ? { soldCount } : {}),
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(reservedCount !== undefined ? { reservedCount } : {}),
  }
}

export function normalizeTicket(raw: Ticket): Ticket {
  const price = parseApiDecimal(ticketPriceRawFromApi(raw))
  return {
    ...raw,
    price: Number.isFinite(price) ? price : NaN,
  }
}

export function normalizeTicketList(list: Ticket[]): Ticket[] {
  return Array.isArray(list) ? list.map(normalizeTicket) : []
}

export function normalizeTicketTypeList(list: TicketType[]): TicketType[] {
  return Array.isArray(list) ? list.map(normalizeTicketType) : []
}
