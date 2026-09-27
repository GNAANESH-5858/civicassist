// Letter PDF with pdf-lib: A4, letterhead line, complaint ID, date, wrapped body, sources at the foot.
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'

export interface LetterPdfInput {
  complaint_id: string
  /** The full letter, including address block, date, subject, reference and closing. */
  body: string
  sources: { id: number; name: string; page: number; official_source: string }[]
}

/** Printed in grey at the top and foot of every page: the letter is the citizen's own draft. */
export const DRAFT_LABEL = 'DRAFT - review, complete the bracketed fields and sign before submitting'

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
  doc.setTitle(`Complaint letter ${input.complaint_id}`)
  doc.setProducer('CivicAssist')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const width = A4[0] - MARGIN * 2
  const grey = rgb(0.5, 0.5, 0.5)
  const labelSize = 8
  const labelWidth = bold.widthOfTextAtSize(DRAFT_LABEL, labelSize)
  // Every page gets the draft label at the top and at the foot.
  const addPage = () => {
    const p = doc.addPage(A4)
    const x = (A4[0] - labelWidth) / 2
    p.drawText(DRAFT_LABEL, { x, y: A4[1] - 30, size: labelSize, font: bold, color: grey })
    p.drawText(DRAFT_LABEL, { x, y: 24, size: labelSize, font: bold, color: grey })
    return p
  }
  let page = addPage()
  let y = A4[1] - MARGIN

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN) {
      page = addPage()
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
