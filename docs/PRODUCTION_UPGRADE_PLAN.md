# CivicAssist production upgrade plan

Written 21 October 2026 after auditing the repository at commit `42d4c68`.

## 1. Audit: what exists today

| Area | State | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 8, React Router 7 | Five routes: `/complaint`, `/advisory`, `/letter`, `/officer`, `/evaluation`. Hand-written CSS design tokens, light/dark theme. English only. |
| Functions | Netlify Functions: `triage.ts`, `llm.ts` | Triage is rule-based + Naive Bayes (no LLM). LLM gateway: Gemini (Netlify AI Gateway base URL supported) with Groq fallback, keys only server-side. |
| Triage | `src/lib/nlp/*` | PII masking, ward regex, urgency rules, TF-IDF repeats, Naive Bayes over 10 **GCC departments**. English only. Routes everything to GCC departments. |
| Schemes | `public/data/schemes.json` (148 records from the PDF), `index.json` (MiniLM embeddings, browser-side) | Self-exclusion filter, locality boost, raw-score relevance gate, lexical support. English-only embedding model. |
| Letter | `letter.v2` prompt, template fallback, pdf-lib PDF | Citizen-to-GCC letter. Standard Helvetica font: **cannot render Tamil or Hindi**. Uses bracket placeholders. |
| Persistence | Browser `localStorage` only | No server-side records, no accounts. Officer dashboard reads a static synthetic file. |
| Officer | `/officer` reads `public/data/triaged.json` | Synthetic data, publicly visible, no access control (acceptable only because data is synthetic). |
| Evaluation | `eval/run.ts` -> `public/data/eval_report.json` | Retrieval, classifier, repeat detection, refusal, 4 failure tests. Synthetic data. |
| Tests | Vitest, 161 tests | 1 known failure: Ward 12 retrieval test expects #84 CMWSSB in top 3. |
| CI / deploy | GitHub Actions `pipeline.yml`, `eval.yml`; Netlify site `civicassist-chennai` deployed by CLI | Netlify not yet linked to Git; 3 local commits unpushed. |

### What is simulated or incomplete
- All 200 complaints are synthetic (template-generated). Labelled as such.
- Routing only knows GCC departments; water/sewerage (CMWSSB), electricity, traffic, police and pollution are not routed to their real authorities.
- No verified submission channels beyond a short list in `config.ts`.
- No chatbot, no follow-up/escalation guidance, no complaint tracking beyond one browser.
- English only.

### Risks found
- Routing every complaint to GCC is wrong for water, sewerage and electricity in Chennai.
- PDF uses WinAnsi fonts: any Tamil/Hindi text becomes `?`.
- Officer dashboard would leak data if it ever showed real records (it has no access control).
- LLM gateway has no rate limit (cost risk).

## 2. Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | **Netlify** (primary, tested). Vercel: documented as not supported in this release. | Existing site, functions, AI Gateway and Blobs are all Netlify. Shipping one tested platform beats two untested ones. |
| Persistence | **Netlify Blobs** (`@netlify/blobs`), strong consistency | Zero new accounts or credentials; works in Netlify Functions automatically. Records are small JSON documents. |
| Citizen access to saved complaints | **Capability links**: random 128-bit record ID + 256-bit secret token; only a SHA-256 hash of the token is stored. Saved in the citizen's browser and shown as a private link. | No account needed; works across devices if the citizen keeps the link. No predictable IDs. Limitation documented: losing the link loses access. |
| Admin access | Server-side bearer token (`CIVICASSIST_ADMIN_TOKEN` env var, timing-safe compare) on every admin endpoint; audit trail per status change | No fake login. Replaceable later by a managed identity provider. |
| i18n | `i18next` + `react-i18next`, bundled JSON in `src/locales/{en,ta,hi}`, key-parity test | No external translation service for the UI. |
| Multilingual understanding | Language-independent **complaint frame** (category, location, duration, hazards). Built by deterministic Tamil/Hindi/English lexicons; optional server-side LLM extraction validated with `zod` | One routing engine for all languages; works without AI. |
| Authority knowledge | Structured JSON in `src/data/civic/` with a source registry (URL, title, verified date, status) | Facts are data with sources, not model output. |
| Assistant | Deterministic dialogue manager calling app tools; LLM optional for understanding free text only | The model never invents procedures; full function without keys. |
| PDF | pdf-lib + fontkit: Noto Sans for Latin (selectable text); HarfBuzz (WASM) shaping for Tamil/Devanagari drawn as vector outlines | Correct Tamil vowel signs and Hindi conjuncts (verified in a spike); pdf-lib alone cannot shape Indic scripts. |
| Animation | `motion` (Motion for React), respecting `prefers-reduced-motion` | Small, maintained. |
| Validation | `zod` on every function input and on LLM output | |
| Rate limiting | Netlify code-based rules (2 allowed on the Free plan): `/api/llm`, `/api/records/*` | Cost and abuse protection. |

## 3. Phases

1. **Audit and plan** (this document).
2. **Verified Chennai civic data**: open official pages, record authorities, complaint categories, channels, emergency numbers and sources with verification dates; `scripts/validate-civic-sources.ts`; maintenance guide.
3. **Guidance engine**: complaint frame, multilingual lexicons, authority routing with jurisdiction uncertainty, conditional follow-up questions, action plans, safety rules.
4. **Civic Assistant** (`/assistant`): dialogue manager, tools, quick starts, language switching, optional LLM extraction with schema validation.
5. **Letters**: structured form, letters in en/ta/hi from templates (AI may polish wording but never facts), validation, multilingual A4 PDF with page numbers, submission panel per authority.
6. **Persistence and admin**: records API on Blobs, capability links, My Complaints, status history, admin dashboard with token auth and audit trail; sample data kept separate and labelled.
7. **Frontend redesign**: home page, navigation, stepper workflow, i18n everywhere, Motion, mobile-first, accessibility.
8. **Testing and security**: unit/integration tests for all of the above, multilingual test set, routing evaluation, security checklist.
9. **Deployment and docs**: Netlify config, README, operations guide, push.

## 4. Out of scope for this release (documented, not faked)
- Automated submission to any government portal (no official API or permission). CivicAssist prepares; the citizen submits.
- Real-time status from government systems (no integration).
- Ward/zone lookup from an address (no verified, licensed dataset). Wards are used only when the citizen states one.
- Cross-device accounts (capability links instead).
- Vercel deployment.
