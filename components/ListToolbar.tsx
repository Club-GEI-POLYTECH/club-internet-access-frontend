'use client'

import type { ReactNode } from 'react'
import { ArrowDownAZ, ArrowUpAZ, Filter, Search } from 'lucide-react'

export type SortOption = { value: string; label: string }

type ListToolbarProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSortByChange: (value: string) => void
  onSortOrderToggle: () => void
  sortOptions: SortOption[]
  limit: number
  onLimitChange: (limit: number) => void
  limitOptions?: number[]
  filters?: ReactNode
  onApply?: () => void
  onReset?: () => void
  applyLabel?: string
}

const DEFAULT_LIMITS = [10, 20, 50, 100]

export default function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderToggle,
  sortOptions,
  limit,
  onLimitChange,
  limitOptions = DEFAULT_LIMITS,
  filters,
  onApply,
  onReset,
  applyLabel = 'Appliquer',
}: ListToolbarProps) {
  return (
    <div className="border-b border-ink-100 bg-ink-50/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <Search className="h-3.5 w-3.5" aria-hidden />
            Recherche <span className="font-normal normal-case text-ink-400">(page affichée)</span>
          </label>
          <input
            type="search"
            className="input text-sm"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onApply?.()}
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
        </div>

        {filters}

        <div className="flex min-w-[140px] flex-col">
          <label htmlFor="list-sort-by" className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Trier par
          </label>
          <div className="flex gap-2">
            <select
              id="list-sort-by"
              className="input flex-1 text-sm"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary shrink-0 px-3"
              onClick={onSortOrderToggle}
              title={sortOrder === 'asc' ? 'Passer en ordre décroissant' : 'Passer en ordre croissant'}
              aria-label={sortOrder === 'asc' ? 'Tri croissant (cliquer pour décroissant)' : 'Tri décroissant (cliquer pour croissant)'}
            >
              {sortOrder === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex min-w-[120px] flex-col">
          <label htmlFor="list-page-size" className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Par page
          </label>
          <select
            id="list-page-size"
            className="input text-sm"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {limitOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {(onApply || onReset) && (
          <div className="flex flex-wrap gap-2 lg:pb-0.5">
            {onReset ? (
              <button type="button" className="btn btn-secondary text-sm" onClick={onReset}>
                Réinitialiser
              </button>
            ) : null}
            {onApply ? (
              <button type="button" className="btn btn-primary text-sm" onClick={onApply}>
                <Filter className="mr-1.5 inline h-4 w-4" aria-hidden />
                {applyLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
