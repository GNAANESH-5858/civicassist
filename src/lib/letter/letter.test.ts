import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import type { Gateway } from '../rag/ask.ts'
import { draftLetter, lintLetter, templateLetter, TEMPLATE_VERSION, wordCount } from './draft.ts'
import { letterPdf, toWinAnsi, wrap } from './pdf.ts'

const scheme = { id: 139, name: 'AMRUT 2.0 Water Supply Coverage', level: 'Central', authority: 'MoHUA', complaint_domains: 'Water', what_it_does: 'x', applicability: 'Urban', official_source: 'https://amrut.mohua.gov.in/', page: 32, kind: 'scheme' as const }
const rule = { ...scheme, id: 86, name: 'Solid Waste Management Rules, 2016', page: 22, kind: 'regulatory' as const, official_source: 'https://moef.gov.in/' }
const input = { complaint: 'No water for 3 days', complaint_id: 'CMP-1', department: 'Water Supply & Sewerage', ward: 'Ward 12', issue: 'water supply', urgency: 'high', records: [scheme, rule] }

describe('templateLetter', () => {
  it('cites records with number, name and page, applies R2 and R3, stays under 200 words', () => {
    const t = templateLetter(input)
    expect(t).toContain('(Scheme #139, AMRUT 2.0 Water Supply Coverage, page 32)')
    expect(t).toContain('The applicable rule for this matter is (Scheme #86')
    expect(t).toContain('may be applicable, subject to eligibility and local verification')
    expect(t).toContain('high priority')
    expect(wordCount(t)).toBeLessThan(200)
    expect(lintLetter(t, input.records)).toEqual([])
  })

  it('mentions no scheme when none were retrieved', () => {
    expect(templateLetter({ ...input, records: [] })).not.toContain('Scheme #')
  })
})

describe('lintLetter', () => {
  it('flags unretrieved schemes, eligibility claims, regulatory-as-benefit and URLs', () => {
    const w = lintLetter('You are eligible. See Scheme #5. Under Scheme #86 you can claim a benefit. https://x.y', [scheme, rule])
    expect(w.join(' ')).toMatch(/#5, which was not retrieved/)
    expect(w.join(' ')).toMatch(/R3/)
    expect(w.join(' ')).toMatch(/#86 as a benefit \(R2\)/)
    expect(w.join(' ')).toMatch(/URL/)
  })
})

describe('draftLetter', () => {
  it('makes two gateway calls: draft then critique', async () => {
    const llm = vi.fn<Gateway>(async (_a, p) => ({ text: p.stage === 'draft' ? 'Dear Citizen, draft' : 'Dear Citizen, revised' }))
    const r = await draftLetter(input, llm)
    expect(llm.mock.calls.map((c) => c[1].stage)).toEqual(['draft', 'critique'])
    expect(llm.mock.calls[1][1].draft).toBe('Dear Citizen, draft')
    expect(r).toMatchObject({ text: 'Dear Citizen, revised', source: 'llm', prompt_version: 'letter.v1', stages: ['draft', 'critique'] })
  })

  it('falls back to the template when the LLM is down', async () => {
    const r = await draftLetter(input, async () => {
      throw new Error('502')
    })
    expect(r).toMatchObject({ source: 'template', prompt_version: TEMPLATE_VERSION })
    expect(r.error).toMatch(/template/)
  })

  it('keeps the draft with a warning when only the critique fails', async () => {
    const r = await draftLetter(input, async (_a, p) => {
      if (p.stage === 'critique') throw new Error('timeout')
      return { text: 'Dear Citizen, draft' }
    })
    expect(r.text).toBe('Dear Citizen, draft')
    expect(r.warnings[0]).toMatch(/Critique step failed/)
  })
})

describe('pdf', () => {
  it('toWinAnsi maps punctuation and drops unsupported characters', () => {
    expect(toWinAnsi('A–B “q” ₹5 தமிழ்')).toBe('A-B "q" Rs.5 ?????')
  })

  it('wraps long lines and hard-breaks long words', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const lines = wrap(`${'word '.repeat(60)}\n\nhttps://${'x'.repeat(200)}`, font, 11, 300)
    expect(lines.length).toBeGreaterThan(5)
    expect(lines).toContain('')
    for (const l of lines) expect(font.widthOfTextAtSize(l, 11)).toBeLessThanOrEqual(300)
  })

  it('produces an A4 PDF', async () => {
    const bytes = await letterPdf({ complaint_id: 'CMP-1', date: new Date('2026-09-27'), body: templateLetter(input), sources: [scheme, rule] })
    const doc = await PDFDocument.load(bytes)
    const { width, height } = doc.getPage(0).getSize()
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842])
    expect(doc.getTitle()).toBe('Acknowledgement CMP-1')
  })
})
