import { describe, expect, it } from 'vitest'
import { deriveGeography, deriveKind, parseEntries } from './parse.ts'

describe('deriveKind', () => {
  it.each([
    ['National rules', 'regulatory'],
    ['National law', 'regulatory'],
    ['National code', 'regulatory'],
    ['Central guidance', 'regulatory'],
    ['Central', 'scheme'],
    ['Tamil Nadu', 'scheme'],
    ['Central fiscal transfer', 'scheme'],
  ])('%s -> %s', (level, kind) => {
    expect(deriveKind(level)).toBe(kind)
  })
})

describe('deriveGeography', () => {
  it.each([
    ['Rural', 'rural'],
    ['Rural / agriculture', 'rural'],
    ['Urban ULBs', 'urban'],
    ['ULBs', 'urban'],
    ['Identified cities', 'urban'],
    ['Rural/peri-urban', 'both'],
    ['Tamil Nadu', 'both'],
    ['National', 'both'],
  ])('%s -> %s', (applicability, geo) => {
    expect(deriveGeography(applicability)).toBe(geo)
  })
})

const footer = (n: number) => `CivicAssist — Person 3 Scheme Knowledge Base Page ${n}`

function entry(n: number, name: string, applicability = 'Urban', level = 'Central'): string[] {
  return [
    `${n}. ${name}`,
    `Level: ${level} Authority: MoHUA`,
    'Complaint domains: Water supply',
    'What it does: Supports water supply in',
    'cities.',
    'AI matching signals: No water, low',
    'pressure.',
    `Applicability: ${applicability}`,
    'Official source: https://example.gov.in/',
  ]
}

describe('parseEntries', () => {
  it('parses one record per entry, joining wrapped lines and skipping footers', () => {
    const pages = [[], [...entry(1, 'AMRUT 2.0'), ...entry(2, 'SWM Rules', 'National', 'National rules'), footer(2)], [...entry(3, 'PMAY-G', 'Rural'), footer(3)]]
    const { records, errors, missing } = parseEntries(pages, 2, 3)

    expect(errors).toEqual([])
    expect(records.map((r) => r.id)).toEqual([1, 2, 3])
    expect(missing).toContain(4)
    expect(missing).not.toContain(1)

    expect(records[0]).toEqual({
      id: 1,
      name: 'AMRUT 2.0',
      level: 'Central',
      authority: 'MoHUA',
      complaint_domains: 'Water supply',
      what_it_does: 'Supports water supply in cities.',
      matching_signals: 'No water, low pressure.',
      applicability: 'Urban',
      official_source: 'https://example.gov.in/',
      page: 2,
      kind: 'scheme',
      geography: 'urban',
    })
    expect(records[1].kind).toBe('regulatory')
    expect(records[2]).toMatchObject({ page: 3, geography: 'rural' })
  })

  it('joins a wrapped scheme name and ignores numbered lines inside a field', () => {
    const lines = entry(1, 'Street Vendors (Protection of Livelihood and')
    lines.splice(1, 0, 'Regulation of Street Vending) Act, 2014')
    lines.splice(5, 0, '2. not a header because no Level line follows')
    const { records } = parseEntries([lines], 1, 1)
    expect(records).toHaveLength(1)
    expect(records[0].name).toBe('Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014')
    expect(records[0].what_it_does).toContain('2. not a header')
  })

  it('joins a line broken after a slash without adding a space', () => {
    const lines = entry(1, 'SBM-U 2.0')
    lines[3] = 'What it does: public/'
    lines[4] = 'community sanitation.'
    expect(parseEntries([lines], 1, 1).records[0].what_it_does).toBe('public/community sanitation.')
  })

  it('reports missing fields and non-URL sources', () => {
    const lines = entry(1, 'Broken').filter((l) => !l.startsWith('Applicability'))
    lines[lines.length - 1] = 'Official source: see website'
    const { errors } = parseEntries([lines], 1, 1)
    expect(errors).toContain('#1: missing field applicability')
    expect(errors.some((e) => e.includes('not a URL'))).toBe(true)
  })
})
