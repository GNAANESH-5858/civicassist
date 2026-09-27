// Trains the Naive Bayes department classifier on data/complaints.csv (80/20 split),
// prints accuracy and a confusion matrix, and saves src/lib/nlp/model.json.
// Usage: npx tsx scripts/train_classifier.ts
import { readFile, writeFile } from 'node:fs/promises'
import { evaluate, split, train, type LabelledText } from '../src/lib/nlp/classifier.ts'
import { DEPARTMENTS } from '../src/lib/nlp/departments.ts'
import { parseCsv } from './lib/csv.ts'

const ABBR: Record<string, string> = {
  'Water Supply & Sewerage': 'WSS',
  'Solid Waste Management': 'SWM',
  'Roads & Storm Water Drains': 'RSD',
  'Street Lighting': 'SL',
  'Public Health & Sanitation': 'PHS',
  'Parks & Water Bodies': 'PWB',
  'Buildings & Town Planning': 'BTP',
  'Health Services': 'HS',
  'Social Welfare': 'SW',
  'Pollution Control': 'PC',
}

const rows = parseCsv(await readFile('data/complaints.csv', 'utf8')) as unknown as (LabelledText & { duplicate_of: string })[]
// Repeats go to training only, so a near-copy of a training row cannot inflate test accuracy.
const originals = rows.filter((r) => !r.duplicate_of)
const repeats = rows.filter((r) => r.duplicate_of)
const { train: trainRows, test } = split(originals, 0.2, 42)
const model = train([...trainRows, ...repeats])
const ev = evaluate(model, test, DEPARTMENTS)

console.log(`Train: ${trainRows.length + repeats.length}  Test: ${test.length}`)
console.log(`Accuracy: ${(ev.accuracy * 100).toFixed(1)}% (${Math.round(ev.accuracy * test.length)}/${test.length})\n`)
console.log('Confusion matrix (rows = actual, columns = predicted)')
const labels = ev.labels.map((l) => ABBR[l])
console.log('      ' + labels.map((l) => l.padStart(4)).join(''))
ev.matrix.forEach((row, i) => console.log(labels[i].padEnd(6) + row.map((n) => String(n || '.').padStart(4)).join('')))
console.log('\nKey: ' + Object.entries(ABBR).map(([k, v]) => `${v}=${k}`).join(', '))

await writeFile('src/lib/nlp/model.json', JSON.stringify(model) + '\n', 'utf8')
await writeFile('data/classifier_report.json', JSON.stringify({ accuracy: ev.accuracy, test_size: test.length, labels: ev.labels, matrix: ev.matrix }, null, 2) + '\n')
console.log('\nSaved src/lib/nlp/model.json and data/classifier_report.json')
