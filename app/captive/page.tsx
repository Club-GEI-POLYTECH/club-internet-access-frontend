'use client'

import { ArrowRight } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { BRAND } from '@/lib/brand'
import { logger } from '@/lib/logger'

/**
 * Page "tampon" pour le portail captif MikroTik
 */
export default function CaptivePage() {
  const handleContinue = () => {
    if (typeof window !== 'undefined') {
      logger.log('Captive: clic Continuer, redirection vers /buy-ticket (HTTPS)')
      const httpsUrl = window.location.href.replace('http://', 'https://').replace('/captive', '/buy-ticket')
      window.location.href = httpsUrl
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4">
      <div className="max-w-md w-full animate-scale-in">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center transition-shadow duration-300 hover:shadow-2xl">
          <BrandLogo size="lg" priority className="mx-auto mb-6" />
          
          <h1 className="mb-4 text-3xl font-bold text-ink-900">
            Bienvenue sur le Wi-Fi
          </h1>
          
          <p className="mb-2 text-ink-600">
            {BRAND.name}
          </p>
          
          <p className="mb-8 text-sm text-ink-500">
            Université de Kinshasa - UNIKIN
          </p>

          <div className="mb-6 rounded-lg bg-primary-50 p-4 transition-colors duration-200">
            <p className="mb-2 text-sm text-ink-800">
              Pour accéder à Internet, vous devez vous connecter ou créer un compte.
            </p>
            <p className="text-xs text-ink-600">
              Cliquez sur le bouton ci-dessous pour continuer.
            </p>
          </div>

          <button
            onClick={handleContinue}
            className="w-full btn btn-primary py-3 text-base font-semibold flex items-center justify-center gap-2 group"
          >
            Continuer pour se connecter
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>

          <div className="mt-6 text-xs text-ink-500">
            <p>En continuant, vous acceptez nos conditions d'utilisation</p>
          </div>
        </div>
      </div>
    </div>
  )
}
