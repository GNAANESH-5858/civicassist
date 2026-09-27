import { useState } from 'react'

// Phase 1 skeleton: posts to the stub triage function to prove the /api wiring.
export default function ComplaintPage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(`Triage failed: HTTP ${res.status}`)
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h1>File a complaint</h1>
      <p className="muted">Describe the problem in your own words. Include your ward if you know it.</p>
      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. No water supply in Ward 12 for three days"
      />
      <button onClick={submit} disabled={loading}>
        {loading ? 'Triaging…' : 'Submit'}
      </button>
      {error && <p className="error">{error}</p>}
      {result !== null && <pre className="card">{JSON.stringify(result, null, 2)}</pre>}
    </section>
  )
}
