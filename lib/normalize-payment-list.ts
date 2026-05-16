import { normalizePaymentAmount } from '@/lib/paginated-api'
import type { Payment, PaymentTicketRef, User } from '@/types/api'
import { UserRole } from '@/types/api'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function str(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  return String(v)
}

/** Ex. notes « KELPAY ticket ol-htjxkz » → `ol-htjxkz` */
export function extractTicketUsernameFromNotes(notes?: string | null): string | undefined {
  if (!notes) return undefined
  const m = notes.match(/ticket\s+([a-z0-9][a-z0-9-]*)/i)
  return m?.[1]
}

function pickUser(raw: unknown): User | undefined {
  const r = asRecord(raw)
  if (!r.id && !r.email && !r.firstName && !r.first_name) return undefined
  return {
    id: String(r.id ?? ''),
    email: String(r.email ?? ''),
    firstName: String(r.firstName ?? r.first_name ?? ''),
    lastName: String(r.lastName ?? r.last_name ?? ''),
    phone: str(r.phone ?? r.phone_number),
    role: (r.role as UserRole) ?? UserRole.STUDENT,
    isActive: r.isActive !== false && r.is_active !== false,
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
  }
}

function pickTicketRef(raw: unknown): PaymentTicketRef | undefined {
  const r = asRecord(raw)
  if (!r.id && !r.username && !r.profile) return undefined
  return {
    id: String(r.id ?? ''),
    username: str(r.username),
    status: str(r.status),
    profile: str(r.profile),
  }
}

/** Uniformise un paiement liste API (camelCase + snake_case, ticket / client). */
export function normalizePaymentFromList(raw: unknown): Payment {
  const r = asRecord(raw)
  const base = (raw && typeof raw === 'object' ? raw : {}) as Payment

  const notes = str(r.notes) ?? base.notes
  let ticket =
    pickTicketRef(r.ticket) ??
    pickTicketRef(r.ticket_ref) ??
    (base.ticket ? pickTicketRef(base.ticket) : undefined)

  const usernameFromNotes = extractTicketUsernameFromNotes(notes)
  if (usernameFromNotes && !ticket?.username) {
    ticket = {
      id: ticket?.id ?? str(r.ticketId ?? r.ticket_id) ?? '',
      username: usernameFromNotes,
      status: ticket?.status,
      profile: ticket?.profile,
    }
  }

  const createdBy =
    pickUser(r.createdBy) ??
    pickUser(r.created_by) ??
    pickUser(r.user) ??
    (base.createdBy ? pickUser(base.createdBy) : undefined)

  return {
    ...base,
    id: String(r.id ?? base.id),
    amount: normalizePaymentAmount(r.amount ?? base.amount),
    method: str(r.method) ?? base.method,
    status: (str(r.status) ?? base.status) as Payment['status'],
    merchantReference: str(r.merchantReference ?? r.merchant_reference) ?? base.merchantReference,
    ticketId: str(r.ticketId ?? r.ticket_id) ?? base.ticketId,
    transactionId: str(r.transactionId ?? r.transaction_id) ?? base.transactionId,
    phoneNumber: str(r.phoneNumber ?? r.phone_number) ?? base.phoneNumber,
    notes,
    createdById: str(r.createdById ?? r.created_by_id) ?? base.createdById,
    createdAt: String(r.createdAt ?? r.created_at ?? base.createdAt),
    updatedAt: str(r.updatedAt ?? r.updated_at) ?? base.updatedAt,
    ticket,
    createdBy,
  }
}
