/** Métadonnées de pagination renvoyées par l’API (`meta`). */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export type SortOrder = 'asc' | 'desc'

export interface PaginationQuery {
  page?: number
  limit?: number
}

export interface UsersListQuery extends PaginationQuery {
  paymentsLimit?: number
  role?: string
}

export interface PaymentsListQuery extends PaginationQuery {
  status?: string
  method?: string
  createdById?: string
}
