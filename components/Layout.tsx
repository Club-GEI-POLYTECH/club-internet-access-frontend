'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/lib/logger'
import { UserRole } from '@/types/api'
import {
  LayoutDashboard,
  CreditCard,
  LogOut,
  Menu,
  X,
  Ticket,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { BrandMark } from '@/components/BrandLogo'
import { BRAND } from '@/lib/brand'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const getNavigation = () => {
    const baseNav = [{ name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard }]

    if (!user) return baseNav

    switch (user.role) {
      case UserRole.ADMIN:
        return [
          ...baseNav,
          { name: 'Utilisateurs', href: '/admin/users', icon: Users },
          { name: 'Import CSV & tickets', href: '/admin/tickets', icon: Ticket },
          { name: 'Paiements', href: '/payments', icon: CreditCard },
        ]

      case UserRole.AGENT:
        return [...baseNav, { name: 'Paiements', href: '/payments', icon: CreditCard }]

      case UserRole.STUDENT:
        return [
          ...baseNav,
          { name: 'Mes tickets', href: '/my-tickets', icon: Ticket },
          { name: 'Acheter', href: '/buy-ticket', icon: ShoppingCart },
          { name: 'Mes paiements', href: '/payments', icon: CreditCard },
        ]

      default:
        return baseNav
    }
  }

  const navigation = getNavigation()
  logger.debug('Layout: navigation', { pathname, role: user?.role, items: navigation.length })

  const handleLogout = () => {
    logger.log('Layout: déconnexion demandée')
    logout()
    router.push('/login')
  }

  const navLinkClass = (active: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-200 shadow-glow-sm border border-primary-400/20'
        : 'border border-transparent text-primary-100/90 hover:bg-white/5 hover:text-white'
    }`

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navigation.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={navLinkClass(isActive)}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-500/30 text-primary-100'
                  : 'bg-white/5 text-primary-200/75 group-hover:bg-white/10 group-hover:text-primary-50'
              }`}
            >
              <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} />
            </span>
            <span>{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen page-mesh-light">
      {/* Mobile overlay sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <button
          type="button"
          className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm"
          aria-label="Fermer le menu"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-white/10 bg-ink-950/95 shadow-2xl shadow-ink-950/40 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-2 border-b border-white/10 px-4">
            <BrandMark size="sm" href="/dashboard" className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer la barre latérale"
              title="Fermer la barre latérale"
              className="rounded-lg p-2 text-primary-200/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <NavList onNavigate={() => setSidebarOpen(false)} />
          <div className="border-t border-white/10 p-4">
            <div className="mb-3 rounded-xl bg-white/5 px-3 py-2">
              <p className="truncate text-sm font-semibold text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-primary-200/70">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100 transition-colors hover:bg-rose-500/20"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col border-r border-white/10 bg-ink-950 bg-mesh-auth">
          <div className="flex h-[4.25rem] items-center border-b border-white/10 px-5">
            <BrandMark size="md" href="/dashboard" subtitle={BRAND.tagline} />
          </div>
          <NavList />
          <div className="mt-auto border-t border-white/10 p-4">
            <div className="mb-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
              <p className="truncate text-sm font-semibold text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-primary-200/70">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100 transition-all hover:bg-rose-500/20"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-ink-200/60 bg-white/70 px-4 backdrop-blur-lg lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl p-2 text-ink-600 hover:bg-ink-100"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <BrandMark size="xs" showTitle subtitle="" onDark={false} className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-xl p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
              aria-label="Déconnexion"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="relative p-4 sm:p-6 lg:p-10">{children}</main>
      </div>
    </div>
  )
}
