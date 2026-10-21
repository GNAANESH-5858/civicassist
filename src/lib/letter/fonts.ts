// Fonts embedded in letter PDFs (OFL-licensed Noto fonts, bundled with the app; no CDN).
// Loaded only when a PDF is generated.
import latinUrl from '@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf?url'
import devanagariUrl from '@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf?url'
import tamilUrl from '@expo-google-fonts/noto-sans-tamil/400Regular/NotoSansTamil_400Regular.ttf?url'
import type { PdfFonts } from './pdf.ts'

let cached: Promise<PdfFonts> | null = null

export function loadPdfFonts(): Promise<PdfFonts> {
  const get = async (u: string) => {
    const r = await fetch(u)
    if (!r.ok) throw new Error(`Could not load font (${r.status})`)
    return r.arrayBuffer()
  }
  cached ??= Promise.all([get(latinUrl), get(tamilUrl), get(devanagariUrl)]).then(([latin, tamil, devanagari]) => ({ latin, tamil, devanagari }))
  cached.catch(() => (cached = null))
  return cached
}
