/**
 * Validation e-mail côté client (complément au type="email" du navigateur).
 * Le backend doit refuser les adresses invalides et limiter le débit d’envoi de codes.
 */
export function isValidRegistrationEmail(email: string): boolean {
  const trimmed = email.trim()
  if (trimmed.length < 5 || trimmed.length > 254) return false
  // Format local@domaine.tld — pas d’espaces, au moins un point dans le domaine
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export function isSixDigitVerificationCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim())
}
