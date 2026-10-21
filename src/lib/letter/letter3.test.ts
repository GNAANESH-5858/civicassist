import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { composeLetter, formatDuration, recipientFor, type LetterFields } from './compose.ts'
import { letterPdf, letterSvgPages, segment, type PdfFonts } from './pdf.ts'
import { checkPolish, factTokens } from './polish.ts'
import { blocking, validateLetter } from './validate.ts'

const base: LetterFields = {
  language: 'en',
  sender_name: 'R. Kumar',
  sender_address: '14, 2nd Cross Street, Velachery, Chennai 600042',
  sender_phone: '98765 43210',
  date: new Date('2026-10-21T10:00:00'),
  authority: 'cmwssb',
  department: null,
  category: 'sewage',
  location: 'Velachery',
  landmark: 'Vijayanagar bus stop',
  description: 'Sewage is overflowing outside my house. The smell is terrible. Call [PHONE]',
  since: { value: 3, unit: 'day' },
  ongoing: true,
  previous_reference: 'CMW/2026/48213',
  attachments: ['2 photographs'],
}

const fonts: PdfFonts = {
  latin: readFileSync('node_modules/@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf'),
  tamil: readFileSync('node_modules/@expo-google-fonts/noto-sans-tamil/400Regular/NotoSansTamil_400Regular.ttf'),
  devanagari: readFileSync('node_modules/@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf'),
}

describe('composeLetter', () => {
  it('writes an English letter from the citizen to the verified recipient, with every fact', () => {
    const l = composeLetter(base)
    expect(l.text).toMatch(/^To,\nChennai Metropolitan Water Supply and Sewerage Board\nNo\.1, Pumping Station Road, Chintadripet, Chennai - 600 002\n/)
    for (const fact of ['21 October 2026', 'Velachery', 'Vijayanagar bus stop', '3 days', 'CMW/2026/48213', '2 photographs', 'R. Kumar', 'Phone: 98765 43210']) expect(l.text).toContain(fact)
    expect(l.text).not.toContain('[PHONE]')
    expect(l.text).not.toMatch(/\[Your|Grievance Cell|Dear Citizen/)
    expect(l.text).toMatch(/Yours faithfully,\nR\. Kumar\n14, 2nd Cross Street/)
  })

  it('uses department-specific GCC designations from the official complaints page', () => {
    expect(recipientFor('gcc', 'Street Lighting').designation).toBe('The Superintending Engineer (Electrical)')
    expect(recipientFor('gcc', 'Unknown dept').designation).toBe('The Commissioner')
  })

  it('omits optional details cleanly when the citizen gives none (no placeholders)', () => {
    const l = composeLetter({ ...base, sender_name: undefined, sender_address: undefined, sender_phone: undefined, landmark: undefined, since: null, previous_reference: undefined, attachments: [] })
    expect(l.text).not.toMatch(/\[|undefined|null|near ,/)
    expect(l.text.trim().endsWith('Yours faithfully,')).toBe(true)
  })

  it('writes Tamil letters with அனுப்புநர் / பெறுநர் and correct Tamil durations', () => {
    const l = composeLetter({ ...base, language: 'ta', location: 'வேளச்சேரி', description: 'வீட்டுக்கு வெளியே கழிவுநீர் வழிந்தோடுகிறது.' })
    expect(l.text).toMatch(/^அனுப்புநர்:\nR\. Kumar/)
    expect(l.text).toContain('பெறுநர்:\nChennai Metropolitan Water Supply and Sewerage Board')
    expect(l.text).toContain('கடந்த 3 நாட்களாக இந்தப் பிரச்சினை தொடர்கிறது')
    expect(l.text).toContain('பொருள்: வேளச்சேரி பகுதியில் கழிவுநீர் மற்றும் மேன்ஹோல் தொடர்பான புகார்')
    expect(l.text).toContain('இப்படிக்கு,')
    expect(l.text).toContain('CMW/2026/48213')
  })

  it('writes Hindi letters with सेवा में, दिनांक, विषय and भवदीय', () => {
    const l = composeLetter({ ...base, language: 'hi', location: 'वेलाचेरी', description: 'मेरे घर के बाहर सीवर का पानी बह रहा है।' })
    expect(l.text).toMatch(/^सेवा में,\n/)
    expect(l.text).toMatch(/दिनांक: 21 अक्तूबर 2026|दिनांक: 21 अक्टूबर 2026/)
    expect(l.text).toContain('विषय: वेलाचेरी में सीवेज और मैनहोल के संबंध में शिकायत')
    expect(l.text).toContain('3 दिन से बनी हुई है')
    expect(l.text).toContain('भवदीय,')
  })

  it('formats durations per language', () => {
    expect(formatDuration({ value: 1, unit: 'week' }, 'en')).toBe('1 week')
    expect(formatDuration({ value: 2, unit: 'week' }, 'ta')).toBe('2 வாரங்கள்')
    expect(formatDuration({ value: 5, unit: 'day' }, 'hi')).toBe('5 दिन')
  })
})

describe('validateLetter', () => {
  const ctx = { location: 'Velachery', hasRecipient: true, senderName: 'R. Kumar', allowedSchemeIds: [] as number[] }
  it('passes a composed letter', () => {
    expect(validateLetter(composeLetter(base).text, ctx)).toEqual([])
  })
  it('blocks placeholders, AI phrases, URLs, unretrieved schemes and eligibility claims', () => {
    const bad = 'Here is your letter.\nTo, [Recipient]\nI am entitled to compensation under scheme 41. See https://x.y\nI request action in Velachery.'
    const codes = validateLetter(bad, ctx).map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['ai_phrase', 'placeholder', 'url_in_body', 'unretrieved_scheme', 'eligibility_claim']))
    expect(blocking(validateLetter(bad, ctx))).toBe(true)
  })
  it('only warns (does not block) when the sender name is missing', () => {
    const issues = validateLetter(composeLetter({ ...base, sender_name: '' }).text, { ...ctx, senderName: '' })
    expect(issues).toEqual([{ code: 'missing_name', level: 'warning' }])
  })
})

describe('polish fact check', () => {
  const body = composeLetter(base).body
  const facts = factTokens(body, ['Velachery', 'Vijayanagar bus stop'])
  it('accepts a rewording that keeps every fact', () => {
    const polished = body.join('\n\n').replace('I am writing to bring to your attention', 'I wish to report')
    expect(checkPolish(body, polished, facts).ok).toBe(true)
  })
  it('rejects a rewording that drops a fact or adds a number', () => {
    expect(checkPolish(body, body.join(' ').replace('CMW/2026/48213', ''), facts).ok).toBe(false)
    expect(checkPolish(body, body.join(' ') + ' It has happened 5 times.', facts).added_numbers).toEqual(['5'])
  })
})

describe('multilingual PDF', () => {
  it('segments mixed text by script', () => {
    expect(segment('Ward 12 வேளச்சேரி, वेलाचेरी').map((r) => r.script)).toEqual(['latin', 'tamil', 'latin', 'devanagari'])
  })

  async function pdfStats(text: string, language: 'en' | 'ta' | 'hi') {
    const bytes = await letterPdf({ text, title: 'Complaint letter', language }, fonts)
    const doc = await PDFDocument.load(bytes)
    let content = ''
    for (const page of doc.getPages()) {
      const c = page.node.Contents()
      const refs = c && 'asArray' in c ? (c as unknown as { asArray(): unknown[] }).asArray() : [c]
      for (const ref of refs) {
        const raw = Buffer.from((doc.context.lookup(ref as never) as unknown as { getContents(): Uint8Array }).getContents())
        try {
          content += inflateSync(raw).toString('latin1')
        } catch {
          content += raw.toString('latin1')
        }
      }
    }
    return { doc, content, pathOps: (content.match(/ c\n| l\n/g) ?? []).length }
  }

  it('renders an English letter as selectable text on A4', async () => {
    const { doc, pathOps } = await pdfStats(composeLetter(base).text, 'en')
    const { width, height } = doc.getPage(0).getSize()
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842])
    expect(doc.getTitle()).toBe('Complaint letter')
    expect(pathOps).toBe(0) // no outlines needed for Latin text
  })

  it('draws Tamil and Hindi glyph outlines (shaped), not missing-glyph boxes', async () => {
    const ta = await pdfStats(composeLetter({ ...base, language: 'ta', location: 'வேளச்சேரி' }).text, 'ta')
    const hi = await pdfStats(composeLetter({ ...base, language: 'hi', location: 'वेलाचेरी' }).text, 'hi')
    expect(ta.pathOps).toBeGreaterThan(500)
    expect(hi.pathOps).toBeGreaterThan(500)
  })

  it('breaks long letters across pages and numbers them', async () => {
    const long = composeLetter({ ...base, impact: 'Residents, including elderly people and school children, cannot walk on the street. '.repeat(30) }).text
    const { doc, content } = await pdfStats(long, 'en')
    expect(doc.getPageCount()).toBeGreaterThan(1)
    // Page labels are drawn at y=36 on every page (embedded-font text is stored as glyph codes).
    expect((content.match(/ 36 Tm/g) ?? []).length).toBe(4 * doc.getPageCount()) // "Page", "n", "of", "N"
  })

  it('produces an SVG of the same layout for visual checks', async () => {
    const pages = await letterSvgPages('वेलाचेरी में गड्ढा — வேளச்சேரியில் பள்ளம்', fonts, (t, s) => t.length * s * 0.5)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toContain('<path d="M')
  })
})
