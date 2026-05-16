import type { SortOrder } from '@/types/pagination'
import type { Payment, UserWithPayments } from '@/types/api'

type SortValue = string | number | boolean | null | undefined

function compareValues(a: SortValue, b: SortValue): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b)
  }

  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return 0
    return a < b ? -1 : 1
  }

  const as = String(a).trim()
  const bs = String(b).trim()
  const da = Date.parse(as)
  const db = Date.parse(bs)
  if (!Number.isNaN(da) && !Number.isNaN(db)) {
    if (da === db) return 0
    return da < db ? -1 : 1
  }

  return as.localeCompare(bs, 'fr', { sensitivity: 'base', numeric: true })
}

function sortWithAccessor<T>(
  items: T[],
  getValue: (item: T) => SortValue,
  order: SortOrder,
): T[] {
  const mult = order === 'asc' ? 1 : -1
  return [...items].sort((left, right) => compareValues(getValue(left), getValue(right)) * mult)
}

const userSortAccessors: Record<string, (u: UserWithPayments) => SortValue> = {
  createdAt: (u) => u.createdAt,
  email: (u) => u.email.toLowerCase(),
  lastName: (u) => `${u.lastName ?? ''}\u0000${u.firstName ?? ''}`.toLowerCase(),
  firstName: (u) => `${u.firstName ?? ''}\u0000${u.lastName ?? ''}`.toLowerCase(),
}

const paymentSortAccessors: Record<string, (p: Payment) => SortValue> = {
  createdAt: (p) => p.createdAt,
  amount: (p) => (typeof p.amount === 'number' ? p.amount : Number(p.amount) || 0),
  status: (p) => String(p.status).toLowerCase(),
}

export function sortUsers(
  items: UserWithPayments[],
  field: string,
  order: SortOrder,
): UserWithPayments[] {
  const accessor = userSortAccessors[field] ?? userSortAccessors.createdAt
  return sortWithAccessor(items, accessor, order)
}

export function sortPayments(items: Payment[], field: string, order: SortOrder): Payment[] {
  const accessor = paymentSortAccessors[field] ?? paymentSortAccessors.createdAt
  return sortWithAccessor(items, accessor, order)
}

/** @deprecated Préférer sortUsers / sortPayments */
export function sortListByField<T extends object>(
  items: T[],
  field: string,
  order: SortOrder,
): T[] {
  return sortWithAccessor(items, (item) => (item as Record<string, unknown>)[field] as SortValue, order)
}
