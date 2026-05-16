import { normalizePaginatedResponse, normalizePaymentAmount } from '@/lib/paginated-api'
import { parseApiDecimal } from '@/lib/normalize-ticket-api'
import type {
  MyTicketListItem,
  MyTicketPaymentSummary,
  MyTicketTypeSummary,
} from '@/types/api'
import { TicketStatus } from '@/types/api'
import type { PaginatedResponse } from '@/types/pagination'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function str(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  return String(v)
}

function normalizeTicketTypeSummary(raw: unknown): MyTicketTypeSummary | undefined {
  const r = asRecord(raw)
  if (!r.id && !r.name && !r.profile && r.price == null) return undefined
  const price = parseApiDecimal(r.price)
  return {
    id: str(r.id),
    name: str(r.name),
    profile: str(r.profile),
    price: Number.isFinite(price) ? price : 0,
  }
}

function normalizePaymentSummary(raw: unknown): MyTicketPaymentSummary | undefined {
  const r = asRecord(raw)
  if (!r.id) return undefined
  const amount = normalizePaymentAmount(r.amount)
  return {
    id: String(r.id),
    amount,
    status: String(r.status ?? ''),
    method: String(r.method ?? ''),
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
  }
}

function resolvePassword(status: string, passwordRaw: string): string {
  const masked = passwordRaw === '***' || passwordRaw === '••••••••'
  if (status === TicketStatus.SOLD || status === 'sold') {
    return masked ? passwordRaw || '***' : passwordRaw
  }
  return '***'
}

export function normalizeMyTicketListItem(raw: unknown): MyTicketListItem {
  const r = asRecord(raw)
  const status = String(r.status ?? TicketStatus.SOLD)
  const ticketType = normalizeTicketTypeSummary(r.ticketType ?? r.ticket_type)
  const payment = normalizePaymentSummary(r.payment)
  const price = parseApiDecimal(r.price ?? ticketType?.price)

  return {
    id: String(r.id ?? ''),
    username: String(r.username ?? ''),
    password: resolvePassword(status, String(r.password ?? '')),
    profile: str(r.profile) ?? ticketType?.profile ?? '',
    status: status as MyTicketListItem['status'],
    timeLimit: str(r.timeLimit ?? r.time_limit),
    dataLimit: str(r.dataLimit ?? r.data_limit),
    price: Number.isFinite(price) ? price : ticketType?.price ?? 0,
    soldAt: str(r.soldAt ?? r.sold_at) ?? payment?.createdAt,
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
    updatedAt: str(r.updatedAt ?? r.updated_at),
    paymentId: str(r.paymentId ?? r.payment_id) ?? payment?.id,
    ticketType,
    payment,
  }
}

export function normalizeMyTicketsPaginated(
  raw: unknown,
  page: number,
  limit: number,
): PaginatedResponse<MyTicketListItem> {
  const result = normalizePaginatedResponse<unknown>(raw, page, limit)
  return {
    data: result.data.map(normalizeMyTicketListItem),
    meta: result.meta,
  }
}

export function getMyTicketProfileLabel(item: MyTicketListItem): string {
  return item.ticketType?.name ?? item.ticketType?.profile ?? (item.profile || 'Forfait')
}

export function canRevealMyTicketPassword(item: MyTicketListItem): boolean {
  return (
    (item.status === TicketStatus.SOLD || item.status === 'sold') &&
    Boolean(item.password?.trim()) &&
    item.password !== '***'
  )
}
