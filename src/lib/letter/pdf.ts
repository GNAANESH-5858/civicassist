// Letter PDF with pdf-lib: A4, letterhead line, complaint ID, date, wrapped body, sources at the foot.
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'

export interface LetterPdfInput {
  complaint_id: string
  date: Date
  body: string
  sources: { id: number; name: string; page: number; official_source: string }[]
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 56

/** Standard PDF fonts only cover WinAnsi; map common Unicode punctuation and drop the rest. */
export function toWinAnsi(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/₹/g, 'Rs.')
    .replace(/\t/g, '    ')
    .replace(/[^\x20-\x7E\n -ÿ]/g, '?')
}

export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (para.trim() === '') {
      out.push('')
      continue
    }
    let line = ''
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next
      else {
        if (line) out.push(line)
        line = word
        // Hard-break a single word longer than the line (e.g. a long URL).
        while (font.widthOfTextAtSize(line, size) > maxWidth) {
          let cut = line.length - 1
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--
          out.push(line.slice(0, cut))
          line = line.slice(cut)
        }
      }
    }
    out.push(line)
  }
  return out
}

export async function letterPdf(input: LetterPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Acknowledgement ${input.complaint_id}`)
  doc.setProducer('CivicAssist')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const width = A4[0] - MARGIN * 2
  let page = doc.addPage(A4)
  let y = A4[1] - MARGIN

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage(A4)
      y = A4[1] - MARGIN
    }
  }
  const draw = (text: string, f: PDFFont, size: number, gap = 4, color = rgb(0.1, 0.1, 0.12)) => {
    for (const line of wrap(toWinAnsi(text), f, size, width)) {
      newPageIfNeeded(size + gap)
      page.drawText(line, { x: MARGIN, y: y - size, size, font: f, color })
      y -= size + gap
    }
  }

  draw('Greater Chennai Corporation - Grievance Cell', bold, 14, 6)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 1, color: rgb(0.2, 0.3, 0.5) })
  y -= 16
  draw(`Complaint ID: ${input.complaint_id}`, font, 10)
  draw(`Date: ${input.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, font, 10)
  y -= 12
  draw(input.body, font, 11, 5)

  if (input.sources.length) {
    y -= 16
    newPageIfNeeded(40)
    page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
    y -= 10
    draw('Official sources (verify current eligibility and guidelines here):', bold, 9, 3)
    for (const s of input.sources) draw(`#${s.id} ${s.name} (knowledge base page ${s.page}): ${s.official_source}`, font, 9, 3, rgb(0.25, 0.25, 0.3))
  }
  return doc.save()
}
