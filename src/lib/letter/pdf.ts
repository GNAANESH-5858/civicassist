// Multilingual A4 letter PDF.
// - Latin text uses embedded Noto Sans (selectable, full Unicode punctuation).
// - Tamil and Devanagari are shaped with HarfBuzz (WASM) so vowel signs, reordering and conjuncts
//   are correct, then drawn as vector outlines. pdf-lib alone cannot shape Indic scripts.
// One layout feeds both the PDF painter and an SVG painter used to check rendering visually.
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Lang } from '../civic/data.ts'

export interface PdfFonts {
  latin: ArrayBuffer | Uint8Array
  tamil: ArrayBuffer | Uint8Array
  devanagari: ArrayBuffer | Uint8Array
}

type Script = 'latin' | 'tamil' | 'devanagari'

export const A4: [number, number] = [595.28, 841.89]
export const PAGE = { marginX: 64, marginTop: 72, marginBottom: 72, size: 11.5, lineHeight: 1.5, paragraphGap: 0.6 }

// ---------- HarfBuzz (loaded lazily, once) ----------

type HB = typeof import('harfbuzzjs')
type HBFont = InstanceType<HB['Font']>
let hbPromise: Promise<HB> | null = null
const loadHB = () => (hbPromise ??= import('harfbuzzjs'))

interface Shaper {
  upem: number
  font: HBFont
  hb: HB
  pathCache: Map<number, string>
}

async function makeShaper(data: ArrayBuffer | Uint8Array): Promise<Shaper> {
  const hb = await loadHB()
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const copy = bytes.slice().buffer
  const face = new hb.Face(new hb.Blob(copy))
  return { upem: face.upem, font: new hb.Font(face), hb, pathCache: new Map() }
}

interface ShapedGlyph {
  gid: number
  x: number // pen offset in points from the run start
  dy: number
  path: string
}

function shapeRun(s: Shaper, text: string, size: number): { glyphs: ShapedGlyph[]; width: number } {
  const buf = new s.hb.Buffer()
  buf.addText(text)
  buf.guessSegmentProperties()
  s.hb.shape(s.font, buf)
  const infos = buf.getGlyphInfos()
  const pos = buf.getGlyphPositions()
  const k = size / s.upem
  let pen = 0
  const glyphs: ShapedGlyph[] = []
  infos.forEach((g, i) => {
    const gid = g.codepoint
    let path = s.pathCache.get(gid)
    if (path === undefined) {
      path = s.font.glyphToPath(gid)
      s.pathCache.set(gid, path)
    }
    glyphs.push({ gid, x: pen + pos[i].xOffset * k, dy: pos[i].yOffset * k, path })
    pen += pos[i].xAdvance * k
  })
  return { glyphs, width: pen }
}

// ---------- Script segmentation ----------

function scriptOf(ch: string): Script | null {
  const c = ch.codePointAt(0)!
  if (c >= 0x0b80 && c <= 0x0bff) return 'tamil'
  if (c >= 0x0900 && c <= 0x097f) return 'devanagari'
  if (c === 0x200c || c === 0x200d) return null // joiners belong to the surrounding run
  return 'latin'
}

export function segment(text: string): { script: Script; text: string }[] {
  const runs: { script: Script; text: string }[] = []
  for (const ch of text) {
    const s = scriptOf(ch) ?? runs[runs.length - 1]?.script ?? 'latin'
    const last = runs[runs.length - 1]
    if (last && last.script === s) last.text += ch
    else runs.push({ script: s, text: ch })
  }
  return runs
}

// ---------- Layout ----------

export interface LaidRun {
  script: Script
  text: string
  x: number
  width: number
  glyphs?: ShapedGlyph[]
}
export interface LaidLine {
  y: number // baseline, from the top of the page
  runs: LaidRun[]
}
export interface LaidPage {
  lines: LaidLine[]
}

export interface Layout {
  pages: LaidPage[]
  size: number
}

interface Measurer {
  latin: PDFFont | { widthOfTextAtSize(t: string, s: number): number }
  shapers: Record<'tamil' | 'devanagari', Shaper>
}

function measureWord(word: string, m: Measurer, size: number): LaidRun[] {
  let x = 0
  return segment(word).map((r) => {
    if (r.script === 'latin') {
      const width = m.latin.widthOfTextAtSize(r.text, size)
      const run = { script: r.script, text: r.text, x, width }
      x += width
      return run
    }
    const shaped = shapeRun(m.shapers[r.script], r.text, size)
    const run = { script: r.script, text: r.text, x, width: shaped.width, glyphs: shaped.glyphs }
    x += shaped.width
    return run
  })
}

export function layoutText(text: string, m: Measurer, opts: Partial<typeof PAGE> = {}): Layout {
  const P = { ...PAGE, ...opts }
  const maxWidth = A4[0] - P.marginX * 2
  const lineStep = P.size * P.lineHeight
  const pages: LaidPage[] = [{ lines: [] }]
  let y = P.marginTop + P.size
  const space = m.latin.widthOfTextAtSize(' ', P.size)
  const newLine = (step: number) => {
    y += step
    if (y > A4[1] - P.marginBottom) {
      pages.push({ lines: [] })
      y = P.marginTop + P.size
      return true
    }
    return false
  }

  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  paragraphs.forEach((para, pi) => {
    if (pi > 0) newLine(lineStep)
    if (!para.trim()) {
      newLine(-lineStep + lineStep * P.paragraphGap) // blank line = smaller gap
      return
    }
    let line: LaidRun[] = []
    let lineWidth = 0
    const flush = () => {
      pages[pages.length - 1].lines.push({ y, runs: line })
      line = []
      lineWidth = 0
    }
    for (const word of para.split(/ +/)) {
      if (!word) continue
      let runs = measureWord(word, m, P.size)
      let w = runs.reduce((s, r) => s + r.width, 0)
      // Hard-break a single word that is wider than the line (e.g. a long reference number).
      while (w > maxWidth && runs.length === 1 && runs[0].script === 'latin' && runs[0].text.length > 1) {
        let cut = runs[0].text.length - 1
        while (cut > 1 && m.latin.widthOfTextAtSize(runs[0].text.slice(0, cut), P.size) > maxWidth - lineWidth) cut--
        const head = measureWord(runs[0].text.slice(0, cut), m, P.size)
        line.push(...head.map((r) => ({ ...r, x: r.x + lineWidth })))
        flush()
        newLine(lineStep)
        runs = measureWord(runs[0].text.slice(cut), m, P.size)
        w = runs.reduce((s, r) => s + r.width, 0)
      }
      const gap = line.length ? space : 0
      if (line.length && lineWidth + gap + w > maxWidth) {
        flush()
        newLine(lineStep)
      }
      const start = lineWidth + (line.length ? space : 0)
      line.push(...runs.map((r) => ({ ...r, x: r.x + start })))
      lineWidth = start + w
    }
    if (line.length) flush()
  })
  return { pages: pages.filter((p) => p.lines.length), size: P.size }
}

// ---------- Painters ----------

/** Glyph outline (font units, y up) to SVG-space path (y down) at pen position, scale k. */
function placePath(path: string, penX: number, baseDy: number, k: number): string {
  let i = 0
  return path.replace(/-?\d+(?:\.\d+)?/g, (n) => {
    const v = Number(n)
    const out = i % 2 === 0 ? v * k + penX : -v * k + baseDy
    i++
    return out.toFixed(2)
  })
}

const PAGE_LABEL: Record<Lang, (n: number, total: number) => string> = {
  en: (n, t) => `Page ${n} of ${t}`,
  ta: (n, t) => `பக்கம் ${n} / ${t}`,
  hi: (n, t) => `पृष्ठ ${n} / ${t}`,
}

export interface LetterPdfInput {
  text: string
  title: string
  language: Lang
}

export async function letterPdf(input: LetterPdfInput, fonts: PdfFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(input.title)
  doc.setCreator('CivicAssist')
  doc.setProducer('CivicAssist')
  doc.setLanguage({ en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' }[input.language])
  const latin = await doc.embedFont(fonts.latin instanceof Uint8Array ? fonts.latin : new Uint8Array(fonts.latin), { subset: true })
  const shapers = { tamil: await makeShaper(fonts.tamil), devanagari: await makeShaper(fonts.devanagari) }
  const layout = layoutText(input.text, { latin, shapers })
  const ink = rgb(0.08, 0.1, 0.13)
  const grey = rgb(0.45, 0.47, 0.5)

  layout.pages.forEach((lp, pi) => {
    const page: PDFPage = doc.addPage(A4)
    for (const line of lp.lines) {
      const baseline = A4[1] - line.y
      for (const run of line.runs) {
        const x = PAGE.marginX + run.x
        if (run.script === 'latin') {
          page.drawText(run.text, { x, y: baseline, size: layout.size, font: latin, color: ink })
        } else {
          const k = layout.size / shapers[run.script].upem
          for (const g of run.glyphs ?? []) {
            if (!g.path) continue
            page.drawSvgPath(placePath(g.path, g.x, -g.dy, k), { x, y: baseline, color: ink, borderWidth: 0 })
          }
        }
      }
    }
    if (layout.pages.length > 1) {
      const label = PAGE_LABEL[input.language](pi + 1, layout.pages.length)
      // Page labels contain script text for ta/hi: lay them out with the same machinery.
      const laid = layoutText(label, { latin, shapers }, { size: 9, marginTop: 0 })
      const runs = laid.pages[0]?.lines[0]?.runs ?? []
      const w = runs.reduce((m, r) => Math.max(m, r.x + r.width), 0)
      const x0 = (A4[0] - w) / 2
      for (const run of runs) {
        if (run.script === 'latin') page.drawText(run.text, { x: x0 + run.x, y: 36, size: 9, font: latin, color: grey })
        else {
          const k = 9 / shapers[run.script].upem
          for (const g of run.glyphs ?? []) if (g.path) page.drawSvgPath(placePath(g.path, g.x, -g.dy, k), { x: x0 + run.x, y: 36, color: grey, borderWidth: 0 })
        }
      }
    }
  })
  return doc.save()
}

/**
 * Renders the same layout to SVG (one SVG per page). Used by tests and scripts to check rendering
 * visually; latin text is drawn with the browser/renderer's sans-serif font.
 */
export async function letterSvgPages(text: string, fonts: PdfFonts, latinWidth: (t: string, size: number) => number): Promise<string[]> {
  const shapers = { tamil: await makeShaper(fonts.tamil), devanagari: await makeShaper(fonts.devanagari) }
  const layout = layoutText(text, { latin: { widthOfTextAtSize: latinWidth }, shapers })
  return layout.pages.map((lp) => {
    let body = ''
    for (const line of lp.lines) {
      for (const run of line.runs) {
        const x = PAGE.marginX + run.x
        if (run.script === 'latin') {
          const esc = run.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
          body += `<text x="${x.toFixed(2)}" y="${line.y.toFixed(2)}" font-family="Noto Sans, Arial, sans-serif" font-size="${layout.size}">${esc}</text>`
        } else {
          const k = layout.size / shapers[run.script].upem
          for (const g of run.glyphs ?? []) if (g.path) body += `<path d="${placePath(g.path, x + g.x, line.y - g.dy, k)}"/>`
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${A4[0]}" height="${A4[1]}" viewBox="0 0 ${A4[0]} ${A4[1]}"><rect width="100%" height="100%" fill="#fff"/><g fill="#14171c">${body}</g></svg>`
  })
}
