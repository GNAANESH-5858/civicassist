// Routing evaluation over a labelled multilingual set: category P/R/F1, authority accuracy,
// and the two kinds of miss that matter to a citizen. A "silent" miss reports the wrong category
// with medium/high confidence; an "asked" miss has low confidence, so the app asks the citizen to choose.
import { buildFrame } from '../src/lib/civic/frame.ts'
import { route } from '../src/lib/civic/routing.ts'

export interface RoutingItem {
  id: string
  lang?: string
  text: string
  category: string
  authority: string
}

export interface RoutingTally {
  n: number
  category_correct: number
  authority_correct: number
  silent_misroutes: number
  asked_to_clarify: number
}

export interface RoutingReport {
  total: RoutingTally & { category_accuracy: number; authority_accuracy: number; macro_f1: number }
  by_language: Record<string, RoutingTally>
  per_category: Record<string, { precision: number; recall: number; f1: number; support: number }>
  misses: string[]
}

const r3 = (x: number) => Math.round(x * 1000) / 1000
const empty = (): RoutingTally => ({ n: 0, category_correct: 0, authority_correct: 0, silent_misroutes: 0, asked_to_clarify: 0 })

export function evaluateRouting(items: RoutingItem[], triageDepartment?: (text: string) => string | null): RoutingReport {
  const total = empty()
  const byLang: Record<string, RoutingTally> = {}
  const pairs: { expected: string; predicted: string }[] = []
  const misses: string[] = []
  for (const it of items) {
    const frame = buildFrame(it.text, { triageDepartment: triageDepartment?.(it.text) ?? null })
    const r = route(frame)
    const lang = it.lang ?? frame.language ?? 'unknown'
    const t = (byLang[lang] ??= empty())
    const catOk = frame.category === it.category
    const authOk = r.authority.id === it.authority
    for (const x of [total, t]) {
      x.n++
      if (catOk) x.category_correct++
      if (authOk) x.authority_correct++
      if (!catOk && frame.confidence !== 'low') x.silent_misroutes++
      if (!catOk && frame.confidence === 'low') x.asked_to_clarify++
    }
    pairs.push({ expected: it.category, predicted: frame.category })
    if (!catOk) misses.push(`${it.id} ${it.category} -> ${frame.category} (${frame.confidence}${authOk ? ', authority still right' : ''})`)
  }
  const labels = [...new Set(pairs.flatMap((p) => [p.expected, p.predicted]))].sort()
  const perCategory: RoutingReport['per_category'] = {}
  for (const l of labels) {
    const tp = pairs.filter((p) => p.expected === l && p.predicted === l).length
    const fp = pairs.filter((p) => p.expected !== l && p.predicted === l).length
    const fn = pairs.filter((p) => p.expected === l && p.predicted !== l).length
    const precision = tp + fp ? tp / (tp + fp) : 0
    const recall = tp + fn ? tp / (tp + fn) : 0
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
    perCategory[l] = { precision: r3(precision), recall: r3(recall), f1: r3(f1), support: tp + fn }
  }
  const supported = Object.values(perCategory).filter((c) => c.support > 0)
  return {
    total: {
      ...total,
      category_accuracy: r3(total.category_correct / Math.max(1, total.n)),
      authority_accuracy: r3(total.authority_correct / Math.max(1, total.n)),
      macro_f1: r3(supported.reduce((s, c) => s + c.f1, 0) / Math.max(1, supported.length)),
    },
    by_language: byLang,
    per_category: perCategory,
    misses,
  }
}
