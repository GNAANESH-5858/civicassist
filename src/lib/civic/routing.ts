// Authority routing from a complaint frame plus the citizen's follow-up answers.
// Everything returned is either a data reference (authority/channel ids with sources) or a message
// key with parameters, so the UI can render it in any language and never invents a procedure.
import { authorityById, channelById, ESCALATION, type Authority, type Channel, type Localized } from './data.ts'
import { categoryOf, type ComplaintFrame, type Confidence } from './frame.ts'

export type Answers = Partial<{
  location: string
  landmark: string
  started: string
  ongoing: 'yes' | 'no' | 'unknown'
  public_private: 'public' | 'private' | 'unknown'
  affects_vulnerable: 'yes' | 'no' | 'unknown'
  previous_complaint: string
  connection_number: string
  danger: 'yes' | 'no' | 'unknown'
  road_type: 'residential' | 'main' | 'highway' | 'unknown'
  pollution_source: 'factory' | 'burning_waste' | 'vehicles' | 'construction' | 'other'
}>

export interface Message {
  key: string
  params?: Record<string, string | number>
}

export interface Routing {
  category: string
  authority: Authority
  department: string | null
  reasons: Message[]
  confidence: Confidence
  uncertainties: (Message | { text: Localized })[]
  /** Ordered: the first is the recommended submission channel. */
  channels: Channel[]
  primary: Channel | null
  fallback: Channel | null
  alternatives: { authority: Authority; when: Localized }[]
  escalation: { channel: Channel; text: Localized }[]
  /** Emergency channels to show before anything else, when hazards were detected. */
  emergency: Channel[]
}

const KIND_ORDER: Channel['kind'][] = ['online_portal', 'phone', 'whatsapp', 'app', 'email', 'website', 'in_person']

function rankChannels(ids: string[]): Channel[] {
  const chans = ids.map((id) => channelById.get(id)).filter((c): c is Channel => Boolean(c))
  // Keep curated order, but never put an unverified channel first when a verified one exists.
  const weight = (c: Channel) => (c.status === 'verified' ? 0 : c.status === 'loads' ? 1 : 2)
  return chans.map((c, i) => ({ c, i })).sort((a, b) => weight(a.c) - weight(b.c) || a.i - b.i).map((x) => x.c)
}

export function route(frame: ComplaintFrame, answers: Answers = {}): Routing {
  const cat = categoryOf(frame)
  let authorityId = cat.primary_authority
  let department = cat.gcc_department ?? null
  const reasons: Message[] = []
  const uncertainties: Routing['uncertainties'] = []
  let confidence: Confidence = frame.confidence

  const matched = frame.candidates.find((c) => c.id === cat.id)?.matched ?? []
  if (frame.category_source === 'user') reasons.push({ key: 'reason.user_selected', params: { category: cat.id } })
  else if (matched.length) reasons.push({ key: 'reason.words_matched', params: { category: cat.id, words: matched.slice(0, 4).join(', ') } })
  else if (frame.category_source === 'classifier') reasons.push({ key: 'reason.classifier', params: { category: cat.id } })
  else reasons.push({ key: 'reason.no_match' })

  // Situation-specific adjustments from the citizen's answers.
  if (cat.id === 'pollution' && answers.pollution_source === 'burning_waste') {
    authorityId = 'gcc'
    department = 'Solid Waste Management'
    reasons.push({ key: 'reason.burning_waste' })
  }
  if (cat.id === 'noise' && answers.pollution_source === 'factory') {
    authorityId = 'tnpcb'
    reasons.push({ key: 'reason.industrial_noise' })
  }

  const authority = authorityById.get(authorityId)!
  reasons.push({ key: 'reason.authority_role', params: { authority: authority.id } })

  if (confidence === 'low') uncertainties.push({ key: 'uncertain.low_confidence' })
  if (frame.candidates.length > 1 && frame.candidates[1].score >= frame.candidates[0].score - 0.5 && frame.category_source !== 'user') {
    uncertainties.push({ key: 'uncertain.two_categories', params: { a: frame.candidates[0].id, b: frame.candidates[1].id } })
  }
  const premises = answers.public_private ?? frame.premises
  if (premises === 'private' && ['water_supply', 'sewage', 'drainage_flooding', 'parks_trees'].includes(cat.id)) {
    uncertainties.push({ key: 'uncertain.private_premises' })
    confidence = confidence === 'high' ? 'medium' : confidence
  }
  if (cat.id === 'roads' && (answers.road_type === 'highway' || answers.road_type === 'main' || answers.road_type === 'unknown' || !answers.road_type)) {
    uncertainties.push({ key: answers.road_type === 'highway' ? 'uncertain.highway' : 'uncertain.road_ownership' })
  }
  if (frame.locality?.maybe_outside_gcc && authority.id === 'gcc') {
    uncertainties.push({ key: 'uncertain.outside_gcc', params: { locality: frame.locality.name } })
    confidence = 'low'
  }
  if (!frame.locality && !frame.ward && !answers.location) uncertainties.push({ key: 'uncertain.no_location' })
  if (frame.ward && authority.id === 'gcc') uncertainties.push({ key: 'uncertain.ward_stated_not_verified', params: { ward: frame.ward } })
  if (cat.jurisdiction_note) uncertainties.push({ text: cat.jurisdiction_note })

  const channels = rankChannels([...authority.channels, ...(cat.extra_channels ?? [])])
  for (const c of channels) if (c.status !== 'verified') uncertainties.push({ key: 'uncertain.channel_not_verified', params: { channel: c.id } })
  if (!channels.length) uncertainties.push({ key: 'uncertain.no_channel', params: { authority: authority.id } })

  const alternatives = cat.alternatives
    .filter((a) => a.authority !== authority.id)
    .map((a) => ({ authority: authorityById.get(a.authority)!, when: a.when }))
  // If an answer moved the primary authority, keep the category's usual authority as the alternative.
  if (authorityId !== cat.primary_authority) {
    const when: Localized =
      cat.id === 'pollution'
        ? { en: 'if the smoke comes from a factory or industrial unit rather than burning garbage', ta: 'புகை குப்பை எரிப்பதால் அல்லாமல் தொழிற்சாலையிலிருந்து வந்தால்', hi: 'यदि धुआँ कचरा जलाने के बजाय किसी कारखाने या औद्योगिक इकाई से आ रहा है' }
        : { en: 'if the noise is not from an industrial source', ta: 'சத்தம் தொழில் மூலத்திலிருந்து அல்லாவிட்டால்', hi: 'यदि शोर किसी औद्योगिक स्रोत से नहीं है' }
    alternatives.unshift({ authority: authorityById.get(cat.primary_authority)!, when })
  }

  const escalation = (ESCALATION.rules[authority.id] ?? [])
    .map((s) => ({ channel: channelById.get(s.channel)!, text: s.text }))
    .filter((s) => s.channel)

  const emergencyIds = frame.hazards.flatMap((h) => h.channels)
  if (answers.danger === 'yes' && !emergencyIds.length) emergencyIds.push('ambulance-108', 'police-100', 'emergency-112')
  const emergency = rankChannels([...new Set(emergencyIds)])

  return {
    category: cat.id,
    authority,
    department,
    reasons,
    confidence,
    uncertainties,
    channels,
    primary: channels[0] ?? null,
    fallback: channels.find((c, i) => i > 0 && c.kind !== channels[0].kind) ?? channels[1] ?? null,
    alternatives,
    escalation,
    emergency,
  }
}

export { KIND_ORDER }
