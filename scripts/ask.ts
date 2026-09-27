// Runs the full advisory pipeline from the command line and prints the result JSON.
// Usage: node --env-file-if-exists=.env --import tsx scripts/ask.ts "question"
import { readFile } from 'node:fs/promises'
import { runAction } from '../netlify/functions/llm.ts'
import { embed } from '../src/lib/embed.ts'
import type { SchemeRecord } from '../src/lib/kb/types.ts'
import { ask } from '../src/lib/rag/ask.ts'
import type { SearchIndex } from '../src/lib/search/rank.ts'

const question = process.argv.slice(2).join(' ')
const records: SchemeRecord[] = JSON.parse(await readFile('public/data/schemes.json', 'utf8'))
const index: SearchIndex = JSON.parse(await readFile('public/data/index.json', 'utf8'))

let llmCalls = 0
const result = await ask(question, {
  records,
  index,
  embed,
  llm: async (action, payload) => {
    llmCalls++
    return runAction(action, payload)
  },
})
console.log(`Question: "${question}"`)
console.log(JSON.stringify({ ...result, llm_calls_attempted: llmCalls }, null, 2))
