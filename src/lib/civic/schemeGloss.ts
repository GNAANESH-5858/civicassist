// Deterministic Tamil/Hindi -> English topic glossary for scheme search when no AI is available.
// The scheme corpus and its embeddings are English; this maps common topic words so a Tamil or
// Hindi question can still find relevant records. It is a fallback, not a translation.
import { normalizeText } from './language.ts'
import { buildFrame, categoryOf } from './frame.ts'

const GLOSS: [string[], string][] = [
  [['வீடு', 'வீட்டு வசதி', 'குடியிருப்பு', 'घर', 'आवास', 'मकान'], 'housing house'],
  [['ஓய்வூதிய', 'பென்ஷன்', 'पेंशन'], 'pension'],
  [['கல்வி', 'படிப்பு', 'பள்ளி', 'कॉलेज', 'शिक्षा', 'पढ़ाई', 'पढाई', 'स्कूल'], 'education school'],
  [['உதவித்தொகை', 'கல்வி உதவி', 'छात्रवृत्ति', 'स्कॉलरशिप'], 'scholarship student'],
  [['மருத்துவ', 'மருத்துவமனை', 'சிகிச்சை', 'उपचार', 'इलाज', 'अस्पताल', 'स्वास्थ्य'], 'health hospital treatment'],
  [['காப்பீடு', 'बीमा'], 'insurance'],
  [['கடன்', 'கடனுதவி', 'ऋण', 'लोन', 'कर्ज़', 'कर्ज'], 'loan credit'],
  [['பெண்', 'மகளிர்', 'महिला', 'स्त्री'], 'women'],
  [['குழந்தை', 'बच्च', 'शिशु'], 'child'],
  [['முதியோர்', 'மூத்த குடிமக்கள்', 'बुजुर्ग', 'वरिष्ठ नागरिक'], 'senior citizens elderly'],
  [['மாற்றுத்திறனாளி', 'ஊனமுற்ற', 'दिव्यांग', 'विकलांग'], 'disability accessibility'],
  [['ரேஷன்', 'உணவுப் பொருள்', 'राशन', 'खाद्य'], 'ration food security'],
  [['எரிவாயு', 'சமையல் எரிவாயு', 'கேஸ்', 'गैस', 'रसोई गैस', 'एलपीजी'], 'cooking gas lpg'],
  [['சூரிய', 'சோலார்', 'सौर', 'सोलर'], 'rooftop solar'],
  [['மின்சாரம்', 'மின் கட்டணம்', 'बिजली', 'बिजली बिल'], 'electricity'],
  [['குடிநீர்', 'தண்ணீர்', 'पानी', 'पेयजल'], 'water supply'],
  [['கழிப்பறை', 'சுகாதாரம்', 'शौचालय', 'स्वच्छता'], 'toilet sanitation'],
  [['வேலை', 'வேலைவாய்ப்பு', 'திறன்', 'नौकरी', 'रोज़गार', 'रोजगार', 'कौशल'], 'employment skill training'],
  [['தெருவோர வியாபாரி', 'தள்ளுவண்டி', 'रेहड़ी', 'रेहडी', 'ठेला', 'फेरीवाला', 'स्ट्रीट वेंडर'], 'street vendor'],
  [['சுய உதவிக் குழு', 'स्वयं सहायता समूह'], 'self help group'],
  [['தொழில்', 'சிறு தொழில்', 'व्यवसाय', 'व्यापार', 'उद्यम'], 'small business enterprise'],
  [['மகப்பேறு', 'கர்ப்ப', 'मातृत्व', 'गर्भवती'], 'maternity pregnancy'],
  [['வீடற்ற', 'தங்குமிடம்', 'बेघर', 'आश्रय'], 'homeless shelter'],
  [['குடும்ப', 'ஏழை', 'परिवार', 'गरीब'], 'family welfare poor households'],
  [['பேருந்து', 'போக்குவரத்து', 'बस', 'परिवहन'], 'public transport bus'],
]

/** English search terms for a Tamil/Hindi (or mixed) question; empty when nothing is recognised. */
export function glossQuery(question: string): string {
  const t = normalizeText(question)
  const terms = GLOSS.filter(([forms]) => forms.some((f) => t.includes(normalizeText(f)))).map(([, en]) => en)
  // Civic categories (pothole, garbage...) also map to English via the complaint lexicon.
  const f = buildFrame(question)
  if (f.confidence !== 'low' || f.candidates.length) terms.push(categoryOf(f).label.en)
  return [...new Set(terms)].join(' ')
}
