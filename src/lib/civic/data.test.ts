import { describe, expect, it } from 'vitest'
import { AUTHORITIES, CATEGORIES, CHANNELS, integrityProblems, LANGS, SOURCES } from './data.ts'

describe('civic knowledge base', () => {
  it('parses every file against its schema and has no broken cross-references', () => {
    expect(SOURCES.length).toBeGreaterThan(10)
    expect(CHANNELS.length).toBeGreaterThan(10)
    expect(integrityProblems()).toEqual([])
  })

  it('every channel and category has text in English, Tamil and Hindi', () => {
    for (const c of CHANNELS) for (const l of LANGS) expect(c.label[l].length, `${c.id}.${l}`).toBeGreaterThan(0)
    for (const c of CATEGORIES) for (const l of LANGS) expect(c.requested_action[l].length, `${c.id}.${l}`).toBeGreaterThan(0)
  })

  it('never presents a channel from an unreachable source as verified', () => {
    const unreachable = new Set(SOURCES.filter((s) => s.status === 'unreachable').map((s) => s.id))
    for (const c of CHANNELS) if (unreachable.has(c.source)) expect(c.status, c.id).not.toBe('verified')
  })

  it('routes water supply and sewerage to Chennai Metro Water, not GCC', () => {
    expect(CATEGORIES.find((c) => c.id === 'water_supply')?.primary_authority).toBe('cmwssb')
    expect(CATEGORIES.find((c) => c.id === 'sewage')?.primary_authority).toBe('cmwssb')
    expect(CATEGORIES.find((c) => c.id === 'electricity')?.primary_authority).toBe('tnpdcl')
  })

  it('does not offer the ERP portal that failed TLS verification', () => {
    expect(CHANNELS.some((c) => c.href.includes('erp.chennaicorporation.gov.in'))).toBe(false)
  })

  it('every authority with channels has at least one verified or loading channel', () => {
    for (const a of AUTHORITIES.filter((x) => x.channels.length)) {
      expect(a.channels.some((id) => CHANNELS.find((c) => c.id === id)?.status !== 'unverified'), a.id).toBe(true)
    }
  })
})
