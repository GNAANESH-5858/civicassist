// Formal complaint letters from the citizen to the responsible authority, in English, Tamil or
// Hindi, built from structured fields. Templates guarantee the structure and the facts; AI may
// only polish the wording of the body (see polish.ts) and is checked against these facts.
// Missing optional details are omitted cleanly: no bracketed placeholders appear in the letter.
import { authorityById, categoryById, pick, type Lang, type LetterRecipient } from '../civic/data.ts'
import type { Duration } from '../civic/lexicon.ts'

export const LETTER_TEMPLATE_VERSION = 'letter.v3'
export const LETTER_MAX_WORDS = 350

export interface LetterFields {
  language: Lang
  /** Sender details stay in the browser. They are never sent to any AI provider or stored server-side. */
  sender_name?: string
  sender_address?: string
  sender_phone?: string
  sender_email?: string
  date: Date
  authority: string
  department: string | null
  category: string
  /** Street / area / ward as the citizen gave it. */
  location: string
  landmark?: string
  /** The citizen's own description (masked text). */
  description: string
  since?: Duration | null
  ongoing?: boolean | null
  impact?: string
  previous_reference?: string
  /** Defaults to the category's requested action in the letter language. */
  requested_action?: string
  attachments?: string[]
  /** Optional programme mention, as supporting grounds phrased as a request. */
  programme?: { id: number; name: string; page: number } | null
  complaint_id?: string
  /** Polished body paragraphs (accepted only after polish.ts fact checks); replaces the template body. */
  body_override?: string[] | null
}

export interface ComposedLetter {
  text: string
  /** Body paragraphs only (no addresses, dates or sender details): the part AI may polish. */
  body: string[]
  subject: string
  recipient: LetterRecipient
  language: Lang
  version: string
}

export function recipientFor(authority: string, department: string | null): LetterRecipient {
  const a = authorityById.get(authority)
  if (!a) return { designation: null, office: 'Greater Chennai Corporation', address: null }
  return (department && a.letter_recipients[department]) || a.letter_recipients.default
}

const LOCALE: Record<Lang, string> = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' }

export function formatDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' })
}

const UNITS: Record<Lang, Record<Duration['unit'], [string, string]>> = {
  en: { hour: ['hour', 'hours'], day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'], year: ['year', 'years'] },
  ta: { hour: ['மணி நேரம்', 'மணி நேரம்'], day: ['நாள்', 'நாட்கள்'], week: ['வாரம்', 'வாரங்கள்'], month: ['மாதம்', 'மாதங்கள்'], year: ['ஆண்டு', 'ஆண்டுகள்'] },
  hi: { hour: ['घंटा', 'घंटे'], day: ['दिन', 'दिन'], week: ['सप्ताह', 'सप्ताह'], month: ['महीना', 'महीने'], year: ['वर्ष', 'वर्ष'] },
}

export function formatDuration(d: Duration, lang: Lang): string {
  const [one, many] = UNITS[lang][d.unit]
  return `${d.value} ${d.value === 1 ? one : many}`
}

// Tamil adverbial forms ("for 3 days" = "3 நாட்களாக").
const TA_ADVERBIAL: Record<Duration['unit'], [string, string]> = {
  hour: ['மணி நேரமாக', 'மணி நேரமாக'],
  day: ['நாளாக', 'நாட்களாக'],
  week: ['வாரமாக', 'வாரங்களாக'],
  month: ['மாதமாக', 'மாதங்களாக'],
  year: ['ஆண்டாக', 'ஆண்டுகளாக'],
}

export function formatDurationAdverbial(d: Duration, lang: Lang): string {
  if (lang !== 'ta') return formatDuration(d, lang)
  const [one, many] = TA_ADVERBIAL[d.unit]
  return `${d.value} ${d.value === 1 ? one : many}`
}

/** Removes masked-PII tokens from the citizen's text: their own contact details go in the sender block. */
function cleanDescription(text: string): string {
  return text
    .replace(/\s*(call|contact|ph|phone|mobile)?\.?:?\s*\[(PHONE|ID|EMAIL)\]\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const T = {
  en: {
    to: 'To,',
    from: null as string | null,
    date: 'Date',
    subject: (cat: string, loc: string) => `Complaint regarding ${cat.toLowerCase()} at ${loc}`,
    reference: (r: string) => `Reference: Previous complaint number ${r}`,
    salutation: 'Sir/Madam,',
    opening: (cat: string, loc: string, lm?: string) => `I am writing to bring to your attention a problem concerning ${cat.toLowerCase()} at ${loc}${lm ? `, near ${lm}` : ''}.`,
    description: (d: string) => d,
    since: (dur: string, ongoing?: boolean | null) => `The problem has continued for ${dur}${ongoing === false ? '' : ' and has not been resolved'}.`,
    impact: (i: string) => i,
    previous: (r: string) => `I had reported this earlier under complaint number ${r}, but the problem remains.`,
    request: (a: string) => `I request you to ${a} at the earliest.`,
    programme: (name: string, id: number, page: number) => `I understand that works of this nature may fall within the scope of the ${name} (CivicAssist knowledge base, scheme ${id}, page ${page}), and request that the matter be considered accordingly, subject to eligibility and local verification.`,
    attachments: (list: string) => `Enclosures: ${list}.`,
    thanks: 'Thank you for your attention to this matter.',
    closing: 'Yours faithfully,',
    phone: 'Phone',
    email: 'Email',
    chennai: 'Chennai',
  },
  ta: {
    to: 'பெறுநர்:',
    from: 'அனுப்புநர்:',
    date: 'நாள்',
    subject: (cat: string, loc: string) => `${loc} பகுதியில் ${cat} தொடர்பான புகார்`,
    reference: (r: string) => `பார்வை: முந்தைய புகார் எண் ${r}`,
    salutation: 'ஐயா/அம்மா,',
    opening: (cat: string, loc: string, lm?: string) => `${loc}${lm ? `, ${lm} அருகில்,` : ''} ${cat} தொடர்பான ஒரு பிரச்சினையைத் தங்கள் கவனத்திற்குக் கொண்டுவர விரும்புகிறேன்.`,
    description: (d: string) => d,
    since: (dur: string, ongoing?: boolean | null) => `கடந்த ${dur} இந்தப் பிரச்சினை ${ongoing === false ? 'இருந்தது.' : 'தொடர்கிறது; இன்னும் தீர்க்கப்படவில்லை.'}`,
    impact: (i: string) => i,
    previous: (r: string) => `இதை முன்னதாக ${r} என்ற புகார் எண்ணில் தெரிவித்திருந்தேன்; ஆனால் பிரச்சினை இன்னும் தொடர்கிறது.`,
    request: (a: string) => `எனவே, விரைவில் ${a} ஆவன செய்யுமாறு பணிவுடன் கேட்டுக்கொள்கிறேன்.`,
    programme: (name: string, id: number, page: number) => `இவ்வகைப் பணிகள் ${name} (CivicAssist அறிவுத் தளம், திட்டம் ${id}, பக்கம் ${page}) வரம்பிற்குள் வரக்கூடும் என அறிகிறேன்; தகுதி மற்றும் உள்ளூர் சரிபார்ப்புக்கு உட்பட்டு, அதன்படி இதைப் பரிசீலிக்குமாறு கேட்டுக்கொள்கிறேன்.`,
    attachments: (list: string) => `இணைப்புகள்: ${list}.`,
    thanks: 'தங்கள் கவனத்திற்கு நன்றி.',
    closing: 'இப்படிக்கு,',
    phone: 'தொலைபேசி',
    email: 'மின்னஞ்சல்',
    chennai: 'சென்னை',
  },
  hi: {
    to: 'सेवा में,',
    from: null as string | null,
    date: 'दिनांक',
    subject: (cat: string, loc: string) => `${loc} में ${cat} के संबंध में शिकायत`,
    reference: (r: string) => `संदर्भ: पिछली शिकायत संख्या ${r}`,
    salutation: 'महोदय/महोदया,',
    opening: (cat: string, loc: string, lm?: string) => `मैं आपका ध्यान ${loc}${lm ? ` में ${lm} के पास` : ''} ${cat} से संबंधित एक समस्या की ओर आकर्षित करना चाहता/चाहती हूँ।`,
    description: (d: string) => d,
    since: (dur: string, ongoing?: boolean | null) => `यह समस्या ${dur} से ${ongoing === false ? 'थी।' : 'बनी हुई है और अभी तक हल नहीं हुई है।'}`,
    impact: (i: string) => i,
    previous: (r: string) => `मैंने इसकी शिकायत पहले शिकायत संख्या ${r} के अंतर्गत की थी, परंतु समस्या अभी भी बनी हुई है।`,
    request: (a: string) => `अतः आपसे निवेदन है कि शीघ्र ${a}।`,
    programme: (name: string, id: number, page: number) => `मुझे ज्ञात हुआ है कि इस प्रकार के कार्य ${name} (CivicAssist ज्ञान आधार, योजना ${id}, पृष्ठ ${page}) के दायरे में आ सकते हैं; पात्रता और स्थानीय सत्यापन के अधीन, कृपया इस पर तदनुसार विचार करें।`,
    attachments: (list: string) => `संलग्नक: ${list}।`,
    thanks: 'इस विषय पर ध्यान देने के लिए धन्यवाद।',
    closing: 'भवदीय,',
    phone: 'फ़ोन',
    email: 'ईमेल',
    chennai: 'चेन्नई',
  },
}

/** Builds the full letter text. Pure and deterministic: the same fields always give the same letter. */
export function composeLetter(f: LetterFields): ComposedLetter {
  const t = T[f.language]
  const cat = categoryById.get(f.category) ?? categoryById.get('other')!
  const catLabel = pick(cat.label, f.language)
  const location = f.location.trim()
  const recipient = recipientFor(f.authority, f.department)
  const sender = [f.sender_name?.trim(), f.sender_address?.trim()].filter(Boolean) as string[]
  const contact = [f.sender_phone?.trim() && `${t.phone}: ${f.sender_phone.trim()}`, f.sender_email?.trim() && `${t.email}: ${f.sender_email.trim()}`].filter(Boolean) as string[]

  const toBlock = [t.to, recipient.designation, recipient.office, recipient.address, recipient.address ? null : t.chennai].filter(Boolean).join('\n')
  const subject = t.subject(catLabel, location)

  const body: string[] = []
  body.push(t.opening(catLabel, location, f.landmark?.trim() || undefined))
  const desc = cleanDescription(f.description)
  if (desc) body.push(t.description(desc))
  const facts: string[] = []
  if (f.since) facts.push(t.since(formatDurationAdverbial(f.since, f.language), f.ongoing))
  if (f.impact?.trim()) facts.push(t.impact(f.impact.trim()))
  if (facts.length) body.push(facts.join(' '))
  if (f.previous_reference?.trim()) body.push(t.previous(f.previous_reference.trim()))
  body.push(t.request((f.requested_action?.trim() || pick(cat.requested_action, f.language)).replace(/[.।]$/, '')))
  if (f.programme) body.push(t.programme(f.programme.name, f.programme.id, f.programme.page))
  if (f.attachments?.length) body.push(t.attachments(f.attachments.join(', ')))
  body.push(t.thanks)
  const finalBody = f.body_override?.length ? f.body_override : body

  const parts: string[] = []
  // Tamil letters conventionally begin with the sender block ("அனுப்புநர்").
  if (t.from && sender.length) parts.push([t.from, ...sender].join('\n'), '')
  parts.push(toBlock, '', `${t.date}: ${formatDate(f.date, f.language)}`, '', `${f.language === 'en' ? 'Subject' : f.language === 'ta' ? 'பொருள்' : 'विषय'}: ${subject}`)
  if (f.previous_reference?.trim()) parts.push(t.reference(f.previous_reference.trim()))
  parts.push('', t.salutation, '', finalBody.join('\n\n'), '', t.closing)
  const signature = t.from ? [f.sender_name?.trim()].filter(Boolean) : [...sender]
  if (signature.length) parts.push(...(signature as string[]))
  if (contact.length) parts.push(...contact)

  return { text: parts.join('\n'), body: finalBody, subject, recipient, language: f.language, version: f.body_override?.length ? `${LETTER_TEMPLATE_VERSION}+ai-polish` : LETTER_TEMPLATE_VERSION }
}
