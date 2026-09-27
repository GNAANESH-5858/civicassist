export interface MaskResult {
  text: string
  counts: { phone: number; id_number: number; email: number }
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// 12-digit ID (Aadhaar style), optionally grouped 4-4-4 with spaces or hyphens.
const ID_RE = /(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d)/g
// 10-digit Indian mobile, optional +91 / 91 / 0 prefix, optional 5-5 split.
const PHONE_RE = /(?<!\d)(?:\+91[ -]?|91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?!\d)/g

/** Masks emails, 12-digit ID numbers and 10-digit phone numbers. IDs run before phones so a 12-digit number is not half-masked. */
export function maskPII(input: string): MaskResult {
  const counts = { phone: 0, id_number: 0, email: 0 }
  const text = input
    .replace(EMAIL_RE, () => (counts.email++, '[EMAIL]'))
    .replace(ID_RE, () => (counts.id_number++, '[ID]'))
    .replace(PHONE_RE, () => (counts.phone++, '[PHONE]'))
  return { text, counts }
}
