'use client'

import { Toaster } from 'sonner'
import 'sonner/dist/styles.css'

/**
 * Toasts Sonner — largeur plafonnée, fond opaque, alignés à droite (surcharges dans `globals.css`).
 */
export function AppToaster() {
  return (
    <Toaster
      theme="light"
      position="top-right"
      richColors
      closeButton
      expand={false}
      visibleToasts={4}
      gap={10}
      offset={16}
      toastOptions={{
        classNames: {
          toast: 'sonner-toast-club',
          title: '!text-sm !font-semibold !leading-snug !text-ink-900',
          description: '!text-sm !leading-relaxed !text-ink-600',
          closeButton: '!border !border-ink-200 !bg-white !text-ink-500 hover:!bg-ink-50',
        },
      }}
    />
  )
}
