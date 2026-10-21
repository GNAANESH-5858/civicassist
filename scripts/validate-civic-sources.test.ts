import { describe, expect, it } from 'vitest'
import { classify } from './validate-civic-sources.ts'

describe('validate-civic-sources', () => {
  it('classifies HTTP statuses', () => {
    expect(classify(200)).toBe('accessible')
    expect(classify(301)).toBe('redirect')
    expect(classify(404)).toBe('broken')
    expect(classify(503)).toBe('broken')
  })
})
