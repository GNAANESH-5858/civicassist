// Extracts text from a PDF as lines per page, using pdfjs-dist in Node.
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

interface TextItem {
  str: string
  transform: number[]
  hasEOL?: boolean
}

/** Groups pdfjs text items into visual lines by their y coordinate, top to bottom. */
export function itemsToLines(items: TextItem[], yTolerance = 2): string[] {
  const rows: { y: number; parts: { x: number; str: string }[] }[] = []
  for (const it of items) {
    if (!it.str) continue
    const x = it.transform[4]
    const y = it.transform[5]
    let row = rows.find((r) => Math.abs(r.y - y) <= yTolerance)
    if (!row) {
      row = { y, parts: [] }
      rows.push(row)
    }
    row.parts.push({ x, str: it.str })
  }
  rows.sort((a, b) => b.y - a.y) // PDF y grows upwards
  return rows
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l.length > 0)
}

/** Returns one array of lines per page; index 0 is page 1. */
export async function extractPageLines(pdfPath: string): Promise<string[][]> {
  const data = new Uint8Array(await readFile(pdfPath))
  const task = getDocument({ data, useSystemFonts: true, verbosity: 0 })
  const doc = await task.promise
  const pages: string[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    pages.push(itemsToLines(content.items as TextItem[]))
  }
  await task.destroy()
  return pages
}
