import BayesClassifier from 'natural/lib/natural/classifiers/bayes_classifier.js'
import type { Department } from './departments.ts'
import { preprocess } from './preprocess.ts'

export interface LabelledText {
  text: string
  department: string
}

export function train(rows: LabelledText[]): BayesClassifier {
  const c = new BayesClassifier()
  for (const r of rows) c.addDocument(preprocess(r.text), r.department)
  c.train()
  return c
}

export function restore(modelJson: unknown): BayesClassifier {
  return BayesClassifier.restore(modelJson)
}

// High-precision keyword rules checked before Naive Bayes. Only terms that belong to
// exactly one department go here; everything else is left to the classifier.
export const KEYWORD_RULES: [RegExp, Department][] = [
  [/\b(sewer|sewage|manhole|underground drainage|ugd)\b/i, 'Water Supply & Sewerage'],
  [/\b(street ?lights?|lamp ?posts?|street lamps?)\b/i, 'Street Lighting'],
  [/\b(stray dogs?|mosquito(es)?|fogging)\b/i, 'Public Health & Sanitation'],
  [/\b(potholes?)\b/i, 'Roads & Storm Water Drains'],
]

export function keywordDepartment(text: string): Department | null {
  // Live wires on street-light poles are still Street Lighting; the first matching rule wins.
  for (const [re, dept] of KEYWORD_RULES) if (re.test(text)) return dept
  return null
}

export function predict(c: BayesClassifier, text: string): Department {
  return keywordDepartment(text) ?? (c.classify(preprocess(text)) as Department)
}

/** Deterministic shuffle (mulberry32) so the 80/20 split is reproducible. */
export function seededShuffle<T>(items: T[], seed = 42): T[] {
  const out = [...items]
  let s = seed >>> 0
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Stratified 80/20 split: each department contributes ~20% of its rows to the test set. */
export function split<T extends LabelledText>(rows: T[], testFraction = 0.2, seed = 42): { train: T[]; test: T[] } {
  const byLabel = new Map<string, T[]>()
  for (const r of rows) byLabel.set(r.department, [...(byLabel.get(r.department) ?? []), r])
  const trainRows: T[] = []
  const testRows: T[] = []
  for (const group of byLabel.values()) {
    const shuffled = seededShuffle(group, seed)
    const nTest = Math.max(1, Math.round(group.length * testFraction))
    testRows.push(...shuffled.slice(0, nTest))
    trainRows.push(...shuffled.slice(nTest))
  }
  return { train: trainRows, test: testRows }
}

export interface Evaluation {
  accuracy: number
  labels: string[]
  /** matrix[actual][predicted] */
  matrix: number[][]
}

export function evaluate(c: BayesClassifier, rows: LabelledText[], labels: readonly string[]): Evaluation {
  const idx = new Map(labels.map((l, i) => [l, i]))
  const matrix = labels.map(() => labels.map(() => 0))
  let correct = 0
  for (const r of rows) {
    const p = predict(c, r.text)
    if (p === r.department) correct++
    const a = idx.get(r.department)
    const q = idx.get(p)
    if (a !== undefined && q !== undefined) matrix[a][q]++
  }
  return { accuracy: rows.length ? correct / rows.length : 0, labels: [...labels], matrix }
}
