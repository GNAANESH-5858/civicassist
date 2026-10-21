// Deterministic multilingual lexicons (English, Tamil, Hindi) for building a complaint frame.
// Locality spellings in Tamil/Hindi are CivicAssist transliterations; they identify a neighbourhood
// for the letter and for jurisdiction notes, never a ward or zone.
import { asciiDigits, normalizeText } from './language.ts'

export interface Locality {
  name: string
  forms: string[]
  /** May be outside Greater Chennai Corporation limits (Avadi and Tambaram corporations exist). */
  maybe_outside_gcc?: boolean
}

export const LOCALITIES: Locality[] = [
  { name: 'Velachery', forms: ['velachery', 'வேளச்சேரி', 'वेलाचेरी'] },
  { name: 'Adyar', forms: ['adyar', 'அடையார்', 'अडयार', 'अड्यार'] },
  { name: 'T. Nagar', forms: ['t. nagar', 't.nagar', 't nagar', 'thyagaraya nagar', 'தி. நகர்', 'தி.நகர்', 'தியாகராய நகர்', 'टी. नगर', 'टी नगर'] },
  { name: 'Anna Nagar', forms: ['anna nagar', 'அண்ணா நகர்', 'अन्ना नगर'] },
  { name: 'Mylapore', forms: ['mylapore', 'மயிலாப்பூர்', 'मयिलापुर', 'मायलापुर'] },
  { name: 'Guindy', forms: ['guindy', 'கிண்டி', 'गिंडी'] },
  { name: 'Egmore', forms: ['egmore', 'எழும்பூர்', 'एग्मोर'] },
  { name: 'Triplicane', forms: ['triplicane', 'திருவல்லிக்கேணி', 'ट्रिप्लिकेन'] },
  { name: 'Royapettah', forms: ['royapettah', 'ராயப்பேட்டை', 'रॉयपेट्टा'] },
  { name: 'Perambur', forms: ['perambur', 'பெரம்பூர்', 'पेरम्बूर'] },
  { name: 'Kodambakkam', forms: ['kodambakkam', 'கோடம்பாக்கம்', 'कोडम्बक्कम'] },
  { name: 'Saidapet', forms: ['saidapet', 'சைதாப்பேட்டை', 'सैदापेट'] },
  { name: 'Nungambakkam', forms: ['nungambakkam', 'நுங்கம்பாக்கம்', 'नुंगमबक्कम'] },
  { name: 'Besant Nagar', forms: ['besant nagar', 'பெசன்ட் நகர்', 'बेसेंट नगर'] },
  { name: 'Thiruvanmiyur', forms: ['thiruvanmiyur', 'திருவான்மியூர்', 'तिरुवनमियूर'] },
  { name: 'Sholinganallur', forms: ['sholinganallur', 'சோழிங்கநல்லூர்', 'शोलिंगनल्लूर'] },
  { name: 'Perungudi', forms: ['perungudi', 'பெருங்குடி', 'पेरुंगुडी'] },
  { name: 'Madipakkam', forms: ['madipakkam', 'மடிப்பாக்கம்', 'मडिपक्कम'] },
  { name: 'Pallikaranai', forms: ['pallikaranai', 'பள்ளிக்கரணை', 'पल्लिकरनई'] },
  { name: 'Ambattur', forms: ['ambattur', 'அம்பத்தூர்', 'अंबत्तूर'] },
  { name: 'Kolathur', forms: ['kolathur', 'கொளத்தூர்', 'कोलातूर'] },
  { name: 'Royapuram', forms: ['royapuram', 'ராயபுரம்', 'रायपुरम'] },
  { name: 'Tondiarpet', forms: ['tondiarpet', 'தண்டையார்பேட்டை', 'तोंडियारपेट'] },
  { name: 'Ashok Nagar', forms: ['ashok nagar', 'அசோக் நகர்', 'अशोक नगर'] },
  { name: 'K. K. Nagar', forms: ['kk nagar', 'k.k. nagar', 'k k nagar', 'கே.கே. நகர்', 'கே.கே.நகர்', 'के.के. नगर'] },
  { name: 'Vadapalani', forms: ['vadapalani', 'வடபழனி', 'वडपलनी'] },
  { name: 'Valasaravakkam', forms: ['valasaravakkam', 'வளசரவாக்கம்', 'वलसरवक्कम'] },
  { name: 'Alandur', forms: ['alandur', 'ஆலந்தூர்', 'आलंदूर'] },
  { name: 'Manali', forms: ['manali', 'மணலி', 'मनाली'] },
  { name: 'Tiruvottiyur', forms: ['tiruvottiyur', 'thiruvottiyur', 'திருவொற்றியூர்', 'तिरुवोट्टियूर'] },
  { name: 'Kilpauk', forms: ['kilpauk', 'கீழ்ப்பாக்கம்', 'किलपॉक'] },
  { name: 'Chetpet', forms: ['chetpet', 'சேத்துப்பட்டு', 'चेटपेट'] },
  { name: 'Teynampet', forms: ['teynampet', 'தேனாம்பேட்டை', 'तेनामपेट'] },
  { name: 'Mandaveli', forms: ['mandaveli', 'மந்தைவெளி', 'मंदावेली'] },
  { name: 'Washermanpet', forms: ['washermanpet', 'வண்ணாரப்பேட்டை', 'वाशरमैनपेट'] },
  { name: 'Purasawalkam', forms: ['purasawalkam', 'purasaiwakkam', 'புரசைவாக்கம்', 'पुरसवाक्कम'] },
  { name: 'Choolaimedu', forms: ['choolaimedu', 'சூளைமேடு', 'चूलैमेडु'] },
  { name: 'Virugambakkam', forms: ['virugambakkam', 'விருகம்பாக்கம்', 'विरुगमबक्कम'] },
  { name: 'Porur', forms: ['porur', 'போரூர்', 'पोरूर'] },
  { name: 'Tambaram', forms: ['tambaram', 'தாம்பரம்', 'ताम्बरम'], maybe_outside_gcc: true },
  { name: 'Chromepet', forms: ['chromepet', 'குரோம்பேட்டை', 'क्रोमपेट'], maybe_outside_gcc: true },
  { name: 'Pallavaram', forms: ['pallavaram', 'பல்லாவரம்', 'पल्लावरम'], maybe_outside_gcc: true },
  { name: 'Avadi', forms: ['avadi', 'ஆவடி', 'आवडी'], maybe_outside_gcc: true },
]

/** First locality mentioned in the text (longest form wins when forms overlap). */
export function findLocality(text: string): Locality | null {
  const t = normalizeText(text)
  let best: { loc: Locality; len: number; at: number } | null = null
  for (const loc of LOCALITIES) {
    for (const f of loc.forms) {
      const at = t.indexOf(f.toLowerCase())
      if (at === -1) continue
      // For Latin forms require a word boundary so "manali" doesn't match inside another word.
      if (/[a-z]/.test(f)) {
        const before = t[at - 1]
        const after = t[at + f.length]
        if ((before && /[a-z]/.test(before)) || (after && /[a-z]/.test(after))) continue
      }
      if (!best || at < best.at || (at === best.at && f.length > best.len)) best = { loc, len: f.length, at }
    }
  }
  return best?.loc ?? null
}

/** "Ward 12", "ward no. 12", "W-12", "வார்டு 12", "वार्ड 12" (1-200 only). */
export function findWard(text: string): number | null {
  const t = asciiDigits(text)
  const m = /(?:\bward|\bwd|\bw|வார்டு|வார்ட்|वार्ड)\s*(?:no\.?|number|num|எண்|नंबर|संख्या|#|-|:)?\s*(\d{1,3})(?!\d)/i.exec(t)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 200 ? n : null
}

/** Phrases introducing a landmark: "near X", "opposite X", "X அருகில்", "X के पास". */
export function findLandmark(text: string): string | null {
  const t = text.normalize('NFC')
  const en = /\b(?:near|opposite|opp\.?|next to|behind|in front of|beside)\s+(?:the\s+)?([A-Za-z0-9 .'&-]{3,60}?)(?=[,.;!?\n]|$| for | since | in ward| and )/i.exec(t)
  if (en) return en[1].trim()
  const ta = /([஀-௿\w .'-]{3,40}?)\s*(?:அருகில்|அருகே|எதிரில்|பக்கத்தில்)/.exec(t)
  if (ta) return ta[1].trim()
  const hi = /([ऀ-ॿ\w .'-]{3,40}?)\s*(?:के पास|के सामने|के पीछे|के बगल)/.exec(t)
  if (hi) return hi[1].trim()
  return null
}

export interface Duration {
  value: number
  unit: 'hour' | 'day' | 'week' | 'month' | 'year'
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, few: 3, several: 3,
  ஒரு: 1, ஒன்று: 1, இரண்டு: 2, மூன்று: 3, நான்கு: 4, ஐந்து: 5, ஆறு: 6, ஏழு: 7, எட்டு: 8, ஒன்பது: 9, பத்து: 10,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10, कुछ: 3,
}
const UNIT_FORMS: [RegExp, Duration['unit']][] = [
  [/^(hours?|hrs?|மணி\S*|घंट\S*)$/i, 'hour'],
  [/^(days?|நாள்\S*|நாட்\S*|दिन\S*)$/i, 'day'],
  [/^(weeks?|வார\S*|हफ्त\S*|सप्ताह\S*)$/i, 'week'],
  [/^(months?|மாத\S*|महीन\S*|माह\S*)$/i, 'month'],
  [/^(years?|வருட\S*|ஆண்ட\S*|साल\S*|वर्ष\S*)$/i, 'year'],
]

/** Duration such as "3 days", "a week", "மூன்று நாட்களாக", "दो हफ़्ते से". Also "since yesterday". */
export function findDuration(text: string): Duration | null {
  const t = normalizeText(text)
  if (/\b(since yesterday|from yesterday)\b|நேற்று முதல்|நேற்றிலிருந்து|कल से/.test(t)) return { value: 1, unit: 'day' }
  if (/\b(since last week|from last week)\b|கடந்த வாரம்|पिछले हफ्ते|पिछले सप्ताह/.test(t)) return { value: 1, unit: 'week' }
  const words = t.replace(/[,.;!?()]/g, ' ').split(' ').filter(Boolean)
  for (let i = 0; i < words.length - 1; i++) {
    const n = /^\d{1,3}$/.test(words[i]) ? Number(words[i]) : NUMBER_WORDS[words[i]]
    if (!n) continue
    // allow one filler word between number and unit ("3 full days", "ஒரு முழு வாரம்")
    for (const j of [i + 1, i + 2]) {
      const w = words[j]
      if (!w) continue
      const unit = UNIT_FORMS.find(([re]) => re.test(w))?.[1]
      if (unit) return { value: n, unit }
    }
  }
  // "ஒரு வாரமாக" style where number and unit are fused with a suffix
  if (/ஒரு\s*வார/.test(t) || /एक\s*(हफ्ते|सप्ताह)/.test(t) || /\ba week\b|\bfor a week\b/.test(t)) return { value: 1, unit: 'week' }
  return null
}

export function durationDays(d: Duration): number {
  return d.value * { hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 }[d.unit]
}

/** Earlier complaint numbers: "complaint no. 123456", "ref GCC/2026/12345", "புகார் எண் 4567". */
export function findReference(text: string): string | null {
  const t = asciiDigits(text)
  const m = /(?:complaint|ref(?:erence)?|token|ticket|petition|grievance|புகார்|குறிப்பு|शिकायत|संदर्भ)\s*(?:no\.?|number|#|id|எண்|नंबर|संख्या)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/\-]{3,30}\d)/i.exec(t)
  return m ? m[1] : null
}

export type YesNo = 'yes' | 'no' | 'unknown'

/** Interprets a short yes/no answer in English, Tamil or Hindi. */
export function parseYesNo(text: string): YesNo | null {
  const t = normalizeText(text).replace(/[.!?]/g, '')
  if (/^(yes|yeah|yep|y|yes it is|still|it is|ஆம்|ஆமா|ஆமாம்|ஆமாங்க|ஆம் இன்னும்|हाँ|हां|हा|जी|जी हाँ|जी हां|बिल्कुल)$/.test(t)) return 'yes'
  if (/^(no|nope|n|not now|no longer|இல்லை|இல்ல|வேண்டாம்|नहीं|ना|नही|जी नहीं)$/.test(t)) return 'no'
  if (/^(not sure|don't know|dont know|unknown|maybe|skip|தெரியாது|தெரியலை|பரவாயில்லை|पता नहीं|मालूम नहीं|शायद|छोडें)$/.test(t)) return 'unknown'
  return null
}

/** True when the text says the problem is inside a private home/building/premises. */
export function mentionsPrivate(text: string): boolean {
  return /\b(inside my house|inside our house|inside the house|inside my flat|inside our building|our apartment|my compound|private property|inside premises)\b|வீட்டுக்குள்|வீட்டுக்குள்ளே|எங்கள் வீட்டில்|கட்டடத்திற்குள்|घर के अंदर|मेरे घर में|हमारी बिल्डिंग|अपार्टमेंट के अंदर/i.test(
    normalizeText(text),
  )
}

/** True when the text says the problem is on a public road/street/area. */
export function mentionsPublic(text: string): boolean {
  return /\b(on the road|on the street|our street|my street|public road|main road|in the lane|outside my house|outside our house|footpath|bus stop)\b|தெருவில்|சாலையில்|ரோட்டில்|வீட்டுக்கு வெளியே|சாலை|सडक पर|गली में|घर के बाहर|मुख्य सडक/i.test(normalizeText(text))
}
