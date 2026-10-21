// Renders sample complaint letters in English, Tamil and Hindi to PNG (via the same layout the
// PDF uses) and writes the PDFs too, so a person can check script rendering by eye.
// Usage: npx tsx scripts/render-letter-preview.ts <output-dir>
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import type { Lang } from '../src/lib/civic/data.ts'
import { composeLetter, type LetterFields } from '../src/lib/letter/compose.ts'
import { letterPdf, letterSvgPages, type PdfFonts } from '../src/lib/letter/pdf.ts'

const out = process.argv[2]
if (!out) {
  console.error('Usage: npx tsx scripts/render-letter-preview.ts <output-dir>')
  process.exit(1)
}

const fonts: PdfFonts = {
  latin: await readFile('node_modules/@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf'),
  tamil: await readFile('node_modules/@expo-google-fonts/noto-sans-tamil/400Regular/NotoSansTamil_400Regular.ttf'),
  devanagari: await readFile('node_modules/@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf'),
}
const measureDoc = await PDFDocument.create()
measureDoc.registerFontkit(fontkit)
const latin = await measureDoc.embedFont(new Uint8Array(fonts.latin as Uint8Array))

const samples: Record<Lang, Partial<LetterFields>> = {
  en: { location: 'Velachery', landmark: 'Vijayanagar bus stop', description: 'Sewage is overflowing outside my house. The smell is terrible and the water has been standing on the road.' },
  ta: { location: 'வேளச்சேரி', landmark: 'விஜயநகர் பேருந்து நிறுத்தம்', description: 'எங்கள் வீட்டுக்கு வெளியே கழிவுநீர் வழிந்தோடுகிறது. மிகவும் துர்நாற்றம் வீசுகிறது; சாலையில் நீர் தேங்கியுள்ளது.' },
  hi: { location: 'वेलाचेरी', landmark: 'विजयनगर बस स्टॉप', description: 'मेरे घर के बाहर सीवर का पानी बह रहा है। बहुत बदबू आ रही है और सड़क पर पानी जमा है। क्षेत्र के बुज़ुर्गों को परेशानी है।' },
}

await mkdir(out, { recursive: true })
for (const lang of ['en', 'ta', 'hi'] as Lang[]) {
  const letter = composeLetter({
    language: lang,
    sender_name: 'R. Kumar',
    sender_address: '14, 2nd Cross Street, Velachery, Chennai 600042',
    date: new Date('2026-10-21T10:00:00'),
    authority: 'cmwssb',
    department: null,
    category: 'sewage',
    location: '',
    description: '',
    since: { value: 3, unit: 'day' },
    previous_reference: 'CMW/2026/48213',
    attachments: [lang === 'en' ? '2 photographs' : lang === 'ta' ? '2 புகைப்படங்கள்' : '2 तस्वीरें'],
    ...samples[lang],
  } as LetterFields)
  const svgs = await letterSvgPages(letter.text, fonts, (t, s) => latin.widthOfTextAtSize(t, s))
  for (const [i, svg] of svgs.entries()) await sharp(Buffer.from(svg), { density: 110 }).png().toFile(`${out}/letter-${lang}-p${i + 1}.png`)
  await writeFile(`${out}/letter-${lang}.pdf`, await letterPdf({ text: letter.text, title: `Complaint letter (${lang})`, language: lang }, fonts))
  console.log(`${lang}: ${svgs.length} page(s) -> ${out}/letter-${lang}-p1.png, ${out}/letter-${lang}.pdf`)
}
