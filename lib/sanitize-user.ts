import type { User } from '@/types/api'

/** Retire tout champ sensible (ex. `password`) si le backend l’inclut par erreur dans un GET. */
export function sanitizePublicUser(raw: User): User {
  if (!raw || typeof raw !== 'object') return raw
  const o = raw as unknown as Record<string, unknown>
  if (!('password' in o)) return raw
  const { password: _unused, ...rest } = o
  void _unused
  return rest as unknown as User
}
