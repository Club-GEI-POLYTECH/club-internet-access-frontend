'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PaginationMeta } from '@/types/pagination'

type PaginationBarProps = {
  meta: PaginationMeta | null
  onPageChange: (page: number) => void
  loading?: boolean
}

export default function PaginationBar({ meta, onPageChange, loading }: PaginationBarProps) {
  if (!meta || meta.total === 0) return null

  const { page, totalPages, total, limit, hasPreviousPage, hasNextPage } = meta
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className="flex flex-col gap-3 border-t border-ink-100 bg-ink-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-600">
        Affichage <span className="font-medium text-ink-900">{from}</span>–
        <span className="font-medium text-ink-900">{to}</span> sur{' '}
        <span className="font-medium text-ink-900">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary inline-flex items-center gap-1 text-sm"
          disabled={!hasPreviousPage || loading}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </button>
        <span className="min-w-[7rem] text-center text-sm font-medium text-ink-700">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary inline-flex items-center gap-1 text-sm"
          disabled={!hasNextPage || loading}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          Suivant
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
