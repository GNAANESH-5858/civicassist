// Typed, validated access to the verified Chennai civic knowledge base (src/data/civic/*.json).
import { z } from 'zod'
import authoritiesJson from '../../data/civic/authorities.json' with { type: 'json' }
import categoriesJson from '../../data/civic/complaint-types.json' with { type: 'json' }
import escalationJson from '../../data/civic/escalation-rules.json' with { type: 'json' }
import sourcesJson from '../../data/civic/source-registry.json' with { type: 'json' }
import channelsJson from '../../data/civic/submission-channels.json' with { type: 'json' }

export const LANGS = ['en', 'ta', 'hi'] as const
export type Lang = (typeof LANGS)[number]

const L = z.object({ en: z.string().min(1), ta: z.string().min(1), hi: z.string().min(1) })
const LList = z.object({ en: z.array(z.string().min(1)), ta: z.array(z.string().min(1)), hi: z.array(z.string().min(1)) })
export type Localized = z.infer<typeof L>
export type LocalizedList = z.infer<typeof LList>

const SourceSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  publisher: z.string(),
  checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['verified', 'loads', 'unreachable']),
  findings: z.array(z.string()).optional(),
  reason: z.string().optional(),
})

const ChannelSchema = z.object({
  id: z.string(),
  authority: z.string(),
  kind: z.enum(['online_portal', 'app', 'whatsapp', 'phone', 'email', 'website', 'in_person']),
  label: L,
  value: z.string().optional(),
  href: z.string().regex(/^(https:\/\/|tel:|mailto:)/),
  alternate: z.object({ value: z.string(), href: z.string().regex(/^(https:\/\/|tel:|mailto:)/) }).optional(),
  requires: z.array(z.enum(['account', 'otp', 'whatsapp', 'app_install'])),
  portal_languages: z.string().optional(),
  instructions: LList,
  source: z.string(),
  also_confirmed_by: z.array(z.string()).optional(),
  status: z.enum(['verified', 'loads', 'unverified']),
  note: z.string().optional(),
})

const RecipientSchema = z.object({ designation: z.string().nullable(), office: z.string(), address: z.string().nullable() })

const AuthoritySchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  type: z.string(),
  verified: z.boolean().optional(),
  explain: L,
  responsibilities: z.array(z.string()),
  not_responsible_for: z.array(z.string()).optional(),
  jurisdiction: L,
  website: z.string().url().nullable(),
  channels: z.array(z.string()),
  letter_recipients: z.record(z.string(), RecipientSchema).refine((r) => 'default' in r, 'needs a default recipient'),
  letter_recipient_note: z.string().optional(),
  sources: z.array(z.string()),
})

const CategorySchema = z.object({
  id: z.string(),
  label: L,
  triage_departments: z.array(z.string()),
  keywords: LList,
  primary_authority: z.string(),
  gcc_department: z.string().optional(),
  extra_channels: z.array(z.string()).optional(),
  alternatives: z.array(z.object({ authority: z.string(), when: L })),
  jurisdiction_note: L.optional(),
  questions: z.array(z.string()),
  evidence: z.array(z.string()),
  requested_action: L,
})

const EscalationSchema = z.object({
  response_timelines_verified: z.boolean(),
  general_follow_up: LList,
  timeline_note: L,
  rules: z.record(z.string(), z.array(z.object({ channel: z.string(), text: L }))),
})

export type Source = z.infer<typeof SourceSchema>
export type Channel = z.infer<typeof ChannelSchema>
export type Authority = z.infer<typeof AuthoritySchema>
export type Category = z.infer<typeof CategorySchema>
export type LetterRecipient = z.infer<typeof RecipientSchema>
export type CategoryId = Category['id']

export const SOURCES: Source[] = z.array(SourceSchema).parse(sourcesJson.sources)
export const CHANNELS: Channel[] = z.array(ChannelSchema).parse(channelsJson.channels)
export const AUTHORITIES: Authority[] = z.array(AuthoritySchema).parse(authoritiesJson.authorities)
export const CATEGORIES: Category[] = z.array(CategorySchema).parse(categoriesJson.categories)
export const ESCALATION = EscalationSchema.parse(escalationJson)

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]))
export const sourceById = byId(SOURCES)
export const channelById = byId(CHANNELS)
export const authorityById = byId(AUTHORITIES)
export const categoryById = byId(CATEGORIES)

export function pick<T>(l: Record<Lang, T>, lang: Lang): T {
  return l[lang] ?? l.en
}

/** Cross-reference problems in the knowledge base (empty = consistent). Used by tests and the source validator. */
export function integrityProblems(): string[] {
  const p: string[] = []
  for (const c of CHANNELS) {
    if (!authorityById.has(c.authority)) p.push(`channel ${c.id}: unknown authority ${c.authority}`)
    const s = sourceById.get(c.source)
    if (!s) p.push(`channel ${c.id}: unknown source ${c.source}`)
    else if (s.status === 'unreachable' && c.status === 'verified') p.push(`channel ${c.id}: marked verified but its source ${s.id} was unreachable`)
    for (const extra of c.also_confirmed_by ?? []) if (!sourceById.has(extra)) p.push(`channel ${c.id}: unknown source ${extra}`)
    for (const lang of LANGS) if (c.instructions[lang].length !== c.instructions.en.length) p.push(`channel ${c.id}: ${lang} instructions have a different number of steps`)
  }
  for (const a of AUTHORITIES) {
    for (const ch of a.channels) if (!channelById.has(ch)) p.push(`authority ${a.id}: unknown channel ${ch}`)
    for (const s of a.sources) if (!sourceById.has(s)) p.push(`authority ${a.id}: unknown source ${s}`)
  }
  for (const c of CATEGORIES) {
    if (!authorityById.has(c.primary_authority)) p.push(`category ${c.id}: unknown authority ${c.primary_authority}`)
    for (const alt of c.alternatives) if (!authorityById.has(alt.authority)) p.push(`category ${c.id}: unknown alternative ${alt.authority}`)
    for (const ch of c.extra_channels ?? []) if (!channelById.has(ch)) p.push(`category ${c.id}: unknown channel ${ch}`)
  }
  for (const [auth, steps] of Object.entries(ESCALATION.rules)) {
    if (!authorityById.has(auth)) p.push(`escalation: unknown authority ${auth}`)
    for (const s of steps) if (!channelById.has(s.channel)) p.push(`escalation ${auth}: unknown channel ${s.channel}`)
  }
  return p
}
