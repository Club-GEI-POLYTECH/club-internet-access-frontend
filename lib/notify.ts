'use client'

import { toast as sonnerToast } from 'sonner'

/** Options supportées (aligné sur l’ancien 3ᵉ argument `notify.*(..., { duration })`). */
export type NotifyOptions = {
  duration?: number
  id?: string | number
}

function opts(description: string | undefined, extra?: NotifyOptions) {
  return {
    ...(description ? { description } : {}),
    ...(extra?.duration != null ? { duration: extra.duration } : {}),
    ...(extra?.id != null ? { id: extra.id } : {}),
  }
}

/**
 * Notifications — basées sur [Sonner](https://sonner.emilkowal.ski/) (toasts compacts, lisibles, non « verre »).
 * API inchangée : `notify.success('Titre', 'Détail optionnel', { duration: 5000 })`.
 */
export const notify = {
  success: (title: string, description?: string, extra?: NotifyOptions) => {
    sonnerToast.success(title, opts(description, extra))
  },

  error: (title: string, description?: string, extra?: NotifyOptions) => {
    sonnerToast.error(title, opts(description, extra))
  },

  info: (title: string, description?: string, extra?: NotifyOptions) => {
    sonnerToast.message(title, opts(description, extra))
  },

  loading: (title: string, description?: string, extra?: NotifyOptions) => {
    return sonnerToast.loading(title, opts(description, extra))
  },

  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId)
  },
}
