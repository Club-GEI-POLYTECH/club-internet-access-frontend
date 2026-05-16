import type { PaginatedResponse, PaginationMeta } from '@/types/pagination'
import { parseApiDecimal, parseApiInt } from '@/lib/normalize-ticket-api'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function normalizeMeta(raw: unknown, dataLength: number, page: number, limit: number): PaginationMeta {
  const m = asRecord(raw)
  const total = pickInt(m, 'total', 'count', 'totalCount')
  const resolvedLimit = pickInt(m, 'limit', 'pageSize') || limit
  const resolvedPage = pickInt(m, 'page', 'currentPage') || page
  const totalPages =
    pickInt(m, 'totalPages', 'pageCount', 'lastPage') ||
    (resolvedLimit > 0 ? Math.max(1, Math.ceil(total / resolvedLimit)) : 1)
  const hasNextPage =
    typeof m.hasNextPage === 'boolean' ? m.hasNextPage : resolvedPage < totalPages
  const hasPreviousPage =
    typeof m.hasPreviousPage === 'boolean' ? m.hasPreviousPage : resolvedPage > 1

  return {
    page: resolvedPage,
    limit: resolvedLimit,
    total: total || dataLength,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  }
}

function pickInt(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    if (!(k in obj)) continue
    return parseApiInt(obj[k])
  }
  return 0
}

/** Construit une query string en ignorant les valeurs vides. */
export function buildListQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    sp.set(key, String(value))
  }
  const q = sp.toString()
  return q ? `?${q}` : ''
}

/** Normalise `{ data, meta }` ou un tableau brut (rétrocompatibilité). */
export function normalizePaginatedResponse<T>(
  raw: unknown,
  fallbackPage: number,
  fallbackLimit: number,
): PaginatedResponse<T> {
  if (Array.isArray(raw)) {
    const data = raw as T[]
    return {
      data,
      meta: {
        page: 1,
        limit: fallbackLimit,
        total: data.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }
  }

  const root = asRecord(raw)
  const dataRaw = root.data ?? root.items ?? root.results
  const data = Array.isArray(dataRaw) ? (dataRaw as T[]) : []
  const meta = normalizeMeta(root.meta ?? root.pagination, data.length, fallbackPage, fallbackLimit)
  return { data, meta }
}

export function normalizePaymentAmount(amount: unknown): number {
  const n = parseApiDecimal(amount)
  return Number.isFinite(n) ? n : 0
}
