// Deterministic safety rules. A generative model is never relied on to recognise an emergency.
import { normalizeText } from './language.ts'

export type HazardId = 'live_wire' | 'fire' | 'gas_leak' | 'collapse' | 'injury' | 'flood_home' | 'open_manhole' | 'contaminated_drinking'

export interface Hazard {
  id: HazardId
  /** 'emergency' = immediate danger to life: emergency services first. 'urgent' = file now, warn others. */
  level: 'emergency' | 'urgent'
  /** Channel ids (submission-channels.json) to show first, in order. */
  channels: string[]
}

// Patterns run on normalizeText() output (lowercase, NFC, Hindi nukta removed).
const RULES: { id: HazardId; level: Hazard['level']; channels: string[]; patterns: RegExp[] }[] = [
  {
    id: 'live_wire',
    level: 'emergency',
    channels: ['tnpdcl-phone', 'ambulance-108', 'emergency-112'],
    patterns: [
      /\b(live wire|exposed wire|hanging wire|fallen wire|wire (has )?fallen|snapped wire|electric shock|electrocut\w*|sparking|sparks from)\b/,
      /மின்\s*கம்பி\s*(அறு|விழு|தொங்)|மின்சாரம்\s*தாக்|ஷாக்|தீப்பொறி/,
      /बिजली\s*का\s*तार\s*(गिर|टूट|लटक)|करंट\s*लग|झटका\s*लग|चिंगारी/,
    ],
  },
  {
    id: 'fire',
    level: 'emergency',
    channels: ['emergency-112', 'ambulance-108'],
    patterns: [/\b(on fire|fire broke|caught fire|house fire|building fire|flames)\b/, /தீ\s*(விபத்து|பற்றி|பிடித்)/, /आग\s*(लग|लगी)/],
  },
  {
    id: 'gas_leak',
    level: 'emergency',
    channels: ['emergency-112'],
    patterns: [/\b(gas leak|smell of gas|lpg leak)\b/, /எரிவாயு\s*கசிவு|கேஸ்\s*கசிவு/, /गैस\s*(रिसाव|लीक)/],
  },
  {
    id: 'collapse',
    level: 'emergency',
    channels: ['emergency-112', 'ambulance-108', 'gcc-1913'],
    patterns: [/\b(collapsed|collapsing|about to collapse|wall fell|building fell|roof caved)\b/, /இடிந்து\s*(விழு|விழ)/, /(ढह|गिर)\s*(गई|गया|रही|रहा|सकती|सकता)\s*(इमारत|दीवार|छत)?|इमारत\s*गिर/],
  },
  {
    id: 'injury',
    level: 'emergency',
    channels: ['ambulance-108', 'police-100'],
    patterns: [/\b(injured|bleeding|unconscious|accident happened|got hurt|fell into)\b/, /காயம்|விபத்து\s*நடந்|ரத்தம்/, /घायल|खून\s*बह|दुर्घटना\s*हुई|बेहोश/],
  },
  {
    id: 'flood_home',
    level: 'emergency',
    channels: ['disaster-1070', 'emergency-112'],
    patterns: [/\b(water entering (our |the )?(house|home)s?|house is flooded|homes flooded|people stranded|stranded in water|water inside (our |the )?house)\b/, /வீட்டுக்குள்\s*(தண்ணீர்|நீர்)|வெள்ளத்தில்\s*சிக்கி/, /घर\s*में\s*पानी\s*(घुस|भर)|बाढ\s*में\s*फँस|फंसे\s*हुए/],
  },
  {
    id: 'open_manhole',
    level: 'urgent',
    channels: ['cmwssb-phone', 'gcc-1913'],
    patterns: [/\b(open manhole|manhole (is )?open|manhole without (a )?(lid|cover)|uncovered manhole|open drain without cover)\b/, /திறந்த\s*(மேன்ஹோல்|சாக்கடை)|மூடி\s*இல்லாத/, /खुला\s*मैनहोल|मैनहोल\s*खुला|ढक्कन\s*नहीं/],
  },
  {
    id: 'contaminated_drinking',
    level: 'urgent',
    channels: ['cmwssb-phone'],
    patterns: [/\b(sewage (mixed|mixing) (with|in) (drinking )?water|contaminated (drinking )?water|people (are )?(falling )?sick|vomiting|diarrh\w*)\b/, /குடிநீரில்\s*கழிவுநீர்|கலங்கலான\s*குடிநீர்|உடல்நலம்\s*பாதிக்/, /पीने\s*के\s*पानी\s*में\s*(सीवर|गंदा)|लोग\s*बीमार|उल्टी|दस्त/],
  },
]

export function detectHazards(text: string): Hazard[] {
  const t = normalizeText(text)
  return RULES.filter((r) => r.patterns.some((p) => p.test(t))).map(({ id, level, channels }) => ({ id, level, channels }))
}

export function safetyLevel(hazards: Hazard[]): 'emergency' | 'urgent' | 'none' {
  if (hazards.some((h) => h.level === 'emergency')) return 'emergency'
  return hazards.length ? 'urgent' : 'none'
}
