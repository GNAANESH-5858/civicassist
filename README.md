# CivicAssist

Independent help for civic issues in Chennai, in **English, Tamil and Hindi**.

A resident describes a problem (a broken streetlight, garbage not collected, no water supply…) and CivicAssist:

1. **Works out where it should go**: the likely authority (Greater Chennai Corporation, Chennai Metro Water, TNPDCL, TNPCB, police…), the department, and why. When it is unsure (low confidence, private premises, highways, places that may be outside Corporation limits) it says so and asks a short follow-up question.
2. **Shows the official channels**: portal, helpline, WhatsApp, app. Each one comes from an official page listed in `src/data/civic/source-registry.json`, with the date it was checked. Unreachable pages are marked as unverified and never shown as verified.
3. **Prepares a complaint letter** from the citizen to the authority in English, Tamil or Hindi. The letter is composed in code (no placeholders) and validated, and it can be copied or downloaded as an A4 PDF with correct Tamil and Devanagari shaping.
4. **Hands off, never submits**: the citizen opens the official channel and submits the complaint themselves. CivicAssist never submits a complaint, sends an email or contacts a department.
5. **Tracks it, optionally**: a private record (no name or phone number) reachable only through a capability link, with a status the citizen updates.
6. **Finds government schemes** from a 148-record knowledge base, cited by record and page.

AI is optional. Routing, safety advice, official links and letters all work without any API key. When a key is configured, AI only fills gaps in free-text understanding, rewrites scheme-search questions and polishes letter wording. A polished letter is rejected if it drops or invents a fact.

> CivicAssist is not an official Government of Tamil Nadu or Greater Chennai Corporation service.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Home: describe an issue, shortcuts |
| `/report` | Guided flow: Describe → Clarify → Review recommendation → Prepare letter → Submit → Track |
| `/assistant` | Deterministic, tool-oriented chat over the same engine |
| `/schemes` | Scheme and regulation search |
| `/letter` | Standalone letter builder |
| `/my-complaints` | Saved private records; status, reference, notes, history, export, delete |
| `/about` | Independence, privacy, AI use, languages, limitations, source registry |
| `/officer` | Demo dashboard on **synthetic** sample data, plus admin view of saved records |
| `/evaluation` | Measured metrics, including multilingual routing and source checks |

## Run locally

```bash
npm install
cp .env.example .env      # all values optional
npx netlify dev           # http://localhost:8888 (Vite + functions)
```

To test the production build with its security headers (CSP), use `npx netlify serve` instead. `netlify dev` also applies the CSP, which blocks Vite's dev-only inline script, so use `npx vite` alone for frontend-only work.

## Tests and checks

```bash
npx tsc -b                # type check
npx vitest run            # unit tests (engine, letters, PDF, functions, locales)
npx vite build            # production build
npx tsx scripts/validate-civic-sources.ts   # live check of every official URL -> data/source_check.json
node --env-file-if-exists=.env --import tsx eval/run.ts   # -> public/data/eval_report.json
```

`src/locales/locales.test.ts` fails if a Tamil or Hindi file is missing a key or placeholder that English has, or if the code uses a key that does not exist.

## Project layout

```
src/data/civic/        verified knowledge base: sources, authorities, channels, complaint types, escalation
src/lib/civic/         language-independent engine: language detection, lexicon, safety, frame, routing,
                       questions, plan, dialogue state machine, message rendering
src/lib/letter/        compose (en/ta/hi templates), validate, AI polish checks, PDF (pdf-lib + harfbuzz)
src/lib/records/       record schema and statuses
src/locales/{en,ta,hi} interface and guidance translations
netlify/functions/     llm.ts (AI gateway), records.ts (Netlify Blobs), triage.ts (rules + Naive Bayes)
eval/                  evaluation sets and runner (development, held-out, first-run record)
docs/                  plan, deployment, security, i18n, source maintenance
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short: Netlify, build `npm run build`, publish `dist`, with functions in `netlify/functions`. Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` / `GOOGLE_GEMINI_BASE_URL` | no | Injected automatically by the Netlify AI Gateway when enabled; or set your own key |
| `GROQ_API_KEY` | no | Fallback AI provider |
| `GEMINI_MODEL`, `GROQ_MODEL` | no | Override default models |
| `CIVICASSIST_ADMIN_TOKEN` | no | Enables the admin records view (at least 32 random characters). Unset means admin is disabled |

Vercel is not supported in this release; the functions use Netlify Blobs and Netlify rate limiting.

## Honest limitations

- Routing accuracy is measured on **synthetic** sets. On the held-out set, the first untuned run got the category right in 19 of 30 cases and the authority in 24 of 30 (`eval/heldout_first_run.json`). Tamil and Hindi examples and translations still need native-speaker review.
- Official response timelines could not be verified, so none are shown.
- Ward boundaries are not verified. Places near Corporation limits (Tambaram, Chromepet, Pallavaram, Avadi) are flagged.
- Known failing test: `tests/retrieval.test.ts` expects scheme #84 in the top 3 for "no water supply in Ward 12"; it ranks 4th (raw score 0.318, below the 0.35 gate). This is left failing on purpose rather than weakened; see the project notes.
- Repeat-detection F1 (0.667) is below its 0.70 target.

More detail: [docs/SECURITY.md](docs/SECURITY.md), [docs/I18N.md](docs/I18N.md), [docs/SOURCE_MAINTENANCE.md](docs/SOURCE_MAINTENANCE.md), [docs/PRODUCTION_UPGRADE_PLAN.md](docs/PRODUCTION_UPGRADE_PLAN.md).
