import { describe, expect, it } from 'vitest'
import { extractIssue, extractWard } from './entities.ts'

describe('extractWard', () => {
  it.each([
    ['No water in ward 12 since Monday', 'Ward 12'],
    ['Ward No. 145 garbage', 'Ward 145'],
    ['ward#7 streetlight', 'Ward 7'],
    ['WARD-200 flooding', 'Ward 200'],
  ])('%s -> %s', (text, ward) => {
    expect(extractWard(text)).toBe(ward)
  })

  it('rejects wards outside 1..200 and text without a ward', () => {
    expect(extractWard('ward 245')).toBeNull()
    expect(extractWard('ward 0')).toBeNull()
    expect(extractWard('broken streetlight near the bus stop')).toBeNull()
  })
})

describe('extractIssue', () => {
  it('finds a noun phrase describing the problem', () => {
    expect(extractIssue('There is a broken streetlight near my house')).toContain('streetlight')
    expect(extractIssue('No water supply in Ward 12')).toBe('water supply')
    expect(extractIssue('Garbage bins overflowing in Ward 5')).toContain('garbage')
  })

  it('returns null when there is nothing to extract', () => {
    expect(extractIssue('')).toBeNull()
  })
})

describe('extractIssue fallback', () => {
  it('uses content words when there is no noun chunk, and trims stray punctuation', () => {
    expect(extractIssue('flooding and waterlogging')).toBe('flooding waterlogging')
    expect(extractIssue('park / water body neglected')).not.toMatch(/^\//)
  })
})
