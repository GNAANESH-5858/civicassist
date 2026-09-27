import { describe, expect, it } from 'vitest'
import { maskPII } from './pii.ts'

describe('maskPII', () => {
  it('masks 10-digit phones with and without prefixes', () => {
    const r = maskPII('Call 9876543210 or +91 98765 43210 or 09876543210')
    expect(r.text).toBe('Call [PHONE] or [PHONE] or [PHONE]')
    expect(r.counts.phone).toBe(3)
  })

  it('masks 12-digit ID numbers, grouped or not, before phones', () => {
    const r = maskPII('Aadhaar 1234 5678 9012 and 123456789012')
    expect(r.text).toBe('Aadhaar [ID] and [ID]')
    expect(r.counts).toEqual({ phone: 0, id_number: 2, email: 0 })
  })

  it('masks emails', () => {
    expect(maskPII('mail me at ravi.k@example.co.in').text).toBe('mail me at [EMAIL]')
  })

  it('leaves ward numbers, dates and short numbers alone', () => {
    const t = 'Ward 145, since 12/03/2026, 3 days, pin 600042'
    expect(maskPII(t).text).toBe(t)
  })
})
