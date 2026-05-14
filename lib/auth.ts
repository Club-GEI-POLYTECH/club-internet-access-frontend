/**
 * Stockage unique du JWT pour le navigateur : **localStorage** + cookie synchronisé
 * (`SameSite=Strict`, `Secure` en production). Ce cookie **n’est pas HttpOnly** (écrit en JS) :
 * il reste lisible par tout script de la page (risque XSS). Pour un niveau supérieur,
 * le backend ou un BFF Next.js doit poser un cookie **HttpOnly** et le middleware lit la session.
 */

import { logger } from './logger'

const TOKEN_KEY = 'token'
const COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60

function readTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const p = part.trim()
    if (!p.startsWith(`${TOKEN_KEY}=`)) continue
    const raw = p.slice(TOKEN_KEY.length + 1)
    if (!raw) return null
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}

export const setToken = (token: string) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Strict${secure}`
  logger.info('Auth: token stocké')
}

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  const fromCookie = readTokenFromCookie()
  if (fromCookie) {
    if (localStorage.getItem(TOKEN_KEY) !== fromCookie) {
      localStorage.setItem(TOKEN_KEY, fromCookie)
    }
    logger.debug('Auth: getToken', 'token présent (cookie)')
    return fromCookie
  }
  const fromLs = localStorage.getItem(TOKEN_KEY)
  logger.debug('Auth: getToken', fromLs ? 'token présent (localStorage)' : 'aucun token')
  return fromLs
}

export const removeToken = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
  logger.info('Auth: token supprimé')
}

export const isAuthenticated = (): boolean => {
  const ok = getToken() !== null
  logger.debug('Auth: isAuthenticated', ok)
  return ok
}
