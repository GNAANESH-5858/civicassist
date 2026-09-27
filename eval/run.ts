// Runs the full evaluation and writes public/data/eval_report.json.
// Usage: node --env-file-if-exists=.env --import tsx eval/run.ts
// Without an LLM key, model-judged metrics (faithfulness, answer relevance) are reported as skipped.
import { readFile, writeFile } from 'node:fs/promises'
import { hasKeys, runAction } from '../netlify/functions/llm.ts'
import { embed } from '../src/lib/embed.ts'
import type { SchemeRecord } from '../src/lib/kb/types.ts'
import model from '../src/lib/nlp/model.json' with { type: 'json' }
import { evaluate, restore, split, train, type LabelledText } from '../src/lib/nlp/classifier.ts'
import { DEPARTMENTS } from '../src/lib/nlp/departments.ts'
import { triage } from '../src/lib/nlp/triage.ts'
import { formatContext } from '../src/lib/prompts/context.ts'
import { ask, toContextRecord, type Gateway } from '../src/lib/rag/ask.ts'
import type { SearchIndex } from '../src/lib/search/rank.ts'
import { parseCsv } from '../scripts/lib/csv.ts'
import { runFailureTests } from './failures.ts'
import { judge } from './judge.ts'
import { duplicateScores, mean, precisionAtK, recallAtK, reciprocalRank } from './metrics.ts'

interface Question {
  id: string
  type: 'answerable' | 'casual' | 'out_of_scope'
  question: string
  expected_id: number | null
  relevant_ids: number[]
  page: number | null
  answer: string
  proving_sentence: string | null
}

const K = 4
const llmAvailable = hasKeys()
const records: SchemeRecord[] = JSON.parse(await readFile('public/data/schemes.json', 'utf8'))
const index: SearchIndex = JSON.parse(await readFile('public/data/index.json', 'utf8'))
const questions: Question[] = JSON.parse(await readFile('eval/questions.json', 'utf8'))
const thresholds: Record<string, number> = JSON.parse(await readFile('eval/thresholds.json', 'utf8'))
const byId = new Map(records.map((r) => [r.id, r]))

// Without keys, every gateway call fails fast and ask() falls back (original query, no answer).
const gateway: Gateway = llmAvailable
  ? (action, payload) => runAction(action, payload)
  : async () => {
      throw new Error('no LLM key')
    }

console.log(`LLM available: ${llmAvailable}`)

// ---- Retrieval + answers ----
const perQuestion: { id: string; type: string; question: string; expected_id: number | null; retrieved: number[]; found: boolean; hit: boolean; answer?: string | null }[] = []
const inScope = questions.filter((q) => q.type !== 'out_of_scope')
const judgements: { faithfulness: number; answer_relevance: number }[] = []
let refused = 0
for (const q of questions) {
  const r = await ask(q.question, { records, index, embed, llm: gateway })
  const retrieved = r.sources.map((s) => s.id)
  if (q.type === 'out_of_scope') {
    if (!r.found) refused++
    perQuestion.push({ id: q.id, type: q.type, question: q.question, expected_id: null, retrieved, found: r.found, hit: !r.found })
    continue
  }
  const hit = retrieved.slice(0, K).includes(q.expected_id!)
  perQuestion.push({ id: q.id, type: q.type, question: q.question, expected_id: q.expected_id, retrieved, found: r.found, hit, answer: r.answer })
  if (llmAvailable && r.answer) {
    const context = formatContext(r.sources.map((s) => toContextRecord(byId.get(s.id)!)))
    judgements.push(await judge(context, q.question, r.answer))
  }
  process.stdout.write(hit ? '.' : 'x')
}
console.log()

const rels = inScope.map((q) => ({ q, retrieved: perQuestion.find((p) => p.id === q.id)!.retrieved }))
const recall = mean(rels.map(({ q, retrieved }) => (retrieved.slice(0, K).includes(q.expected_id!) ? 1 : 0)))
const recallAll = mean(rels.map(({ q, retrieved }) => recallAtK(retrieved, q.relevant_ids, K)))
const precision = mean(rels.map(({ q, retrieved }) => precisionAtK(retrieved, q.relevant_ids, K)))
const mrr = mean(rels.map(({ q, retrieved }) => reciprocalRank(retrieved, q.relevant_ids)))

// ---- Department classifier (same deterministic split as training) ----
const complaints = parseCsv(await readFile('data/complaints.csv', 'utf8')) as unknown as (LabelledText & { id: string; duplicate_of: string })[]
const originals = complaints.filter((c) => !c.duplicate_of)
const { train: trainRows, test } = split(originals, 0.2, 42)
const clf = train([...trainRows, ...complaints.filter((c) => c.duplicate_of)])
const deptEval = evaluate(clf, test, DEPARTMENTS)

// ---- Repeat detection over all 200 complaints, in order ----
const shipped = restore(model)
const prior: { id: string; text: string; ward: string | null }[] = []
const dupRows = complaints.map((c) => {
  const t = triage({ text: c.text, id: c.id, recent: prior }, shipped)
  prior.push({ id: c.id, text: t.masked_text, ward: t.ward })
  return { predicted: t.duplicate_of, expected: c.duplicate_of || null }
})
const dup = duplicateScores(dupRows)

// ---- Failure-mode tests ----
const failureTests = await runFailureTests({ records, index, embed, classifier: shipped })

// ---- Report ----
const metric = (key: string, value: number | null, note?: string) => ({
  value: value === null ? null : Math.round(value * 1000) / 1000,
  threshold: thresholds[key],
  pass: value === null ? null : value >= thresholds[key],
  ...(note ? { note } : {}),
})
const skipped = 'Skipped: no LLM key available for this run.'
const report = {
  generated_at: new Date().toISOString(),
  llm_available: llmAvailable,
  counts: { questions: questions.length, answerable: questions.filter((q) => q.type === 'answerable').length, casual: questions.filter((q) => q.type === 'casual').length, out_of_scope: questions.filter((q) => q.type === 'out_of_scope').length, complaints: complaints.length },
  metrics: {
    recall_at_4: metric('recall_at_4', recall, `Expected scheme in top ${K} (${inScope.length} in-scope questions). Recall over all relevant ids: ${recallAll.toFixed(3)}.`),
    precision_at_4: metric('precision_at_4', precision),
    mrr: metric('mrr', mrr),
    faithfulness: metric('faithfulness', judgements.length ? mean(judgements.map((j) => j.faithfulness)) : null, judgements.length ? `LLM judge over ${judgements.length} answers.` : skipped),
    answer_relevance: metric('answer_relevance', judgements.length ? mean(judgements.map((j) => j.answer_relevance)) : null, judgements.length ? `LLM judge over ${judgements.length} answers.` : skipped),
    department_accuracy: metric('department_accuracy', deptEval.accuracy, `Held-out ${test.length} complaints (stratified 80/20).`),
    duplicate_f1: metric('duplicate_f1', dup.f1, `precision ${dup.precision.toFixed(2)}, recall ${dup.recall.toFixed(2)} (tp ${dup.tp}, fp ${dup.fp}, fn ${dup.fn}).`),
    out_of_scope_refusal: metric('out_of_scope_refusal', refused / questions.filter((q) => q.type === 'out_of_scope').length, llmAvailable ? undefined : 'Refusal by retrieval gates only (no LLM NOT_FOUND check).'),
  },
  failure_tests: failureTests,
  classifier: { accuracy: deptEval.accuracy, test_size: test.length, labels: deptEval.labels, matrix: deptEval.matrix },
  per_question: perQuestion,
}
await writeFile('public/data/eval_report.json', JSON.stringify(report, null, 2) + '\n', 'utf8')

console.table(Object.fromEntries(Object.entries(report.metrics).map(([k, m]) => [k, { value: m.value, threshold: m.threshold, pass: m.pass }])))
console.table(failureTests.map((t) => ({ test: t.name.split(':')[0], pass: t.pass, detail: t.detail.slice(0, 90) })))
console.log('Misses:', perQuestion.filter((p) => p.hit === false).map((p) => `${p.id} expected ${p.expected_id ?? 'refusal'} got [${p.retrieved.join(',')}]`))
console.log('Wrote public/data/eval_report.json')
