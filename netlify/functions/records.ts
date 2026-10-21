// Complaint records API on Netlify Blobs.
//   POST   /api/records              create (anyone)            -> { id, token, record }
//   GET    /api/records/:id          read   (record token|admin)
//   PATCH  /api/records/:id          update (record token|admin) appends to status history
//   DELETE /api/records/:id          delete (record token)
//   GET    /api/records              list   (admin only)
// Access: each record has a random id and a 256-bit secret token; only its SHA-256 hash is stored.
// Admin: bearer token compared in constant time with CIVICASSIST_ADMIN_TOKEN (disabled if unset).
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import { maskPII } from '../../src/lib/nlp/pii.ts'
import { publicView, RecordInputSchema, RecordUpdateSchema, type ComplaintRecord, type StoredRecord } from '../../src/lib/records/schema.ts'

export const MAX_BODY_BYTES = 16 * 1024
const PREFIX = 'rec/'

/** Minimal key-value interface so tests can use memory instead of Netlify Blobs. */
export interface RecordStore {
  get(key: string): Promise<StoredRecord | null>
  set(key: string, value: StoredRecord): Promise<void>
  delete(key: string): Promise<void>
  list(prefix: string): Promise<string[]>
}

function blobStore(): RecordStore {
  const s = getStore({ name: 'complaint-records', consistency: 'strong' })
  return {
    get: async (k) => (await s.get(k, { type: 'json' })) as StoredRecord | null,
    set: async (k, v) => void (await s.setJSON(k, v)),
    delete: (k) => s.delete(k),
    list: async (p) => (await s.list({ prefix: p })).blobs.map((b) => b.key),
  }
}

let storeOverride: RecordStore | null = null
/** For tests only. */
export function setStoreForTests(s: RecordStore | null) {
  storeOverride = s
}
const store = () => storeOverride ?? blobStore()

const sha256 = (s: string) => createHash('sha256').update(s).digest()
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+([A-Za-z0-9_\-.~+/=]{16,200})$/.exec(h)
  return m ? m[1] : null
}

export function isAdmin(req: Request): boolean {
  const configured = process.env.CIVICASSIST_ADMIN_TOKEN
  const given = bearer(req)
  if (!configured || configured.length < 32 || !given) return false
  return timingSafeEqual(sha256(configured), sha256(given))
}

function tokenMatches(record: StoredRecord, token: string | null): boolean {
  if (!token) return false
  return timingSafeEqual(Buffer.from(record.token_hash, 'hex'), sha256(token))
}

async function readBody(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > MAX_BODY_BYTES) throw new Error('too_large')
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) throw new Error('too_large')
  return JSON.parse(text)
}

const mask = (v: string | null | undefined) => (v ? maskPII(v).text : v)

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const id = url.pathname.replace(/\/+$/, '').split('/').pop() ?? ''
  const isCollection = /\/records$/.test(url.pathname.replace(/\/+$/, ''))
  const s = store()

  try {
    if (isCollection && req.method === 'POST') {
      let body: unknown
      try {
        body = await readBody(req)
      } catch (e) {
        return json({ error: (e as Error).message === 'too_large' ? 'Request too large' : 'Body must be JSON' }, (e as Error).message === 'too_large' ? 413 : 400)
      }
      const parsed = RecordInputSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'Invalid record', issues: parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message) }, 400)
      const now = new Date().toISOString()
      const token = randomBytes(32).toString('base64url')
      const d = parsed.data
      const record: StoredRecord = {
        ...d,
        title: mask(d.title)!,
        summary: mask(d.summary)!,
        notes: mask(d.notes) ?? null,
        status: d.status as StoredRecord['status'],
        id: randomUUID(),
        token_hash: sha256(token).toString('hex'),
        created_at: now,
        updated_at: now,
        history: [{ at: now, status: d.status as StoredRecord['status'], by: 'citizen' }],
        is_sample: false,
      }
      await s.set(PREFIX + record.id, record)
      return json({ id: record.id, token, record: publicView(record) }, 201)
    }

    if (isCollection && req.method === 'GET') {
      if (!isAdmin(req)) return json({ error: process.env.CIVICASSIST_ADMIN_TOKEN ? 'Unauthorized' : 'Admin access is not configured' }, process.env.CIVICASSIST_ADMIN_TOKEN ? 401 : 503)
      const keys = await s.list(PREFIX)
      const records: ComplaintRecord[] = []
      for (const k of keys.slice(0, 2000)) {
        const r = await s.get(k)
        if (r) records.push(publicView(r))
      }
      records.sort((a, b) => b.created_at.localeCompare(a.created_at))
      return json({ records })
    }

    if (!ID_RE.test(id)) return json({ error: 'Not found' }, 404)
    const record = await s.get(PREFIX + id)
    const admin = isAdmin(req)
    // Same response for "missing" and "wrong token", so ids cannot be probed.
    if (!record || (!admin && !tokenMatches(record, bearer(req)))) return json({ error: 'Not found' }, 404)

    if (req.method === 'GET') return json({ record: publicView(record) })

    if (req.method === 'PATCH') {
      let body: unknown
      try {
        body = await readBody(req)
      } catch {
        return json({ error: 'Body must be JSON' }, 400)
      }
      const parsed = RecordUpdateSchema.safeParse(body)
      if (!parsed.success) return json({ error: 'Invalid update', issues: parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message) }, 400)
      const { history_note, ...u } = parsed.data
      const now = new Date().toISOString()
      const next: StoredRecord = {
        ...record,
        ...u,
        notes: u.notes !== undefined ? (mask(u.notes) ?? null) : record.notes,
        resolution_notes: u.resolution_notes !== undefined ? (mask(u.resolution_notes) ?? null) : record.resolution_notes,
        status: (u.status as StoredRecord['status']) ?? record.status,
        updated_at: now,
      }
      if ((u.status && u.status !== record.status) || history_note) {
        next.history = [...record.history, { at: now, status: next.status, by: (admin ? 'admin' : 'citizen') as 'admin' | 'citizen', ...(history_note ? { note: mask(history_note)! } : {}) }].slice(-100)
      }
      await s.set(PREFIX + id, next)
      return json({ record: publicView(next) })
    }

    if (req.method === 'DELETE') {
      if (admin && !tokenMatches(record, bearer(req))) return json({ error: 'Only the citizen who created a record can delete it' }, 403)
      await s.delete(PREFIX + id)
      return json({ deleted: true })
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (e) {
    // Never echo internals or record contents in errors.
    console.error('records function error:', (e as Error).name)
    return json({ error: 'Storage is temporarily unavailable' }, 503)
  }
}

export const config: Config = {
  path: ['/api/records', '/api/records/*'],
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
