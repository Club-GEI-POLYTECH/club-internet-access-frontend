'use client'

import { Suspense } from 'react'
import Login from '@/components/Login'

function LoginPageFallback() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-mesh-auth opacity-90" />
      <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-primary-300" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <Login />
    </Suspense>
  )
}
