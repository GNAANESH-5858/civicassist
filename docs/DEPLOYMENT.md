# Deployment (Netlify)

The site is a static Vite build plus three Netlify Functions:

| Function | Route (from `config.path`) | Rate limit |
| --- | --- | --- |
| `netlify/functions/llm.ts` | `/api/llm` | 30 requests / 60 s per IP |
| `netlify/functions/records.ts` | `/api/records`, `/api/records/*` | 60 requests / 60 s per IP |
| `netlify/functions/triage.ts` | `/api/triage` | none (no model call; the Free plan allows two code-based rules) |

Records are stored in Netlify Blobs (store `complaint-records`, strong consistency). There is no database to provision.

## Current setup

The site `civicassist-chennai` (https://civicassist-chennai.netlify.app) is deployed from the CLI; it is **not** connected to Git.

### Deploy from the CLI (current method)

```bash
npx netlify login            # once
npx netlify link             # once, choose civicassist-chennai
npx netlify deploy --build --prod
```

### Optional: connect Git for automatic deploys

1. app.netlify.com → the site → **Site configuration → Build & deploy → Link repository** → GitHub → this repository, branch `main`.
2. Build settings are read from `netlify.toml`: command `npm run build`, publish `dist`, functions `netlify/functions`.
3. Every push to `main` then deploys. Note that the build runs `tsc -b` but not the tests; CI (`.github/workflows/pipeline.yml`) runs the tests.

## Environment variables

Set them under **Site configuration → Environment variables**, scope **Functions**, then redeploy. All are optional.

| Variable | Notes |
| --- | --- |
| AI Gateway (`GEMINI_API_KEY`, `GOOGLE_GEMINI_BASE_URL`) | With the Netlify AI Gateway enabled, Netlify injects these automatically. To use your own Google key instead, set `GEMINI_API_KEY` only. |
| `GROQ_API_KEY` | Fallback provider if Gemini fails. |
| `GEMINI_MODEL`, `GROQ_MODEL` | Override the default model names. |
| `CIVICASSIST_ADMIN_TOKEN` | Enables `/officer` → Saved records. Use at least 32 random characters, for example `openssl rand -base64 36`. If unset, admin endpoints return 503. Admins can view and update the status of records, but cannot delete them. |

Keys are read only inside the functions. They are never sent to the browser or committed (`.env` is git-ignored).

## Security headers

`netlify.toml` sets a Content Security Policy and other headers for every path. The scheme search downloads its embedding model from Hugging Face and the ONNX WASM runtime from jsDelivr, so those hosts are allowed in `connect-src` / `script-src`. If you change the embedding setup, update the CSP. Check after deploying:

```bash
curl -sI https://civicassist-chennai.netlify.app/ | grep -i content-security
```

## After deploying, check

1. `/report`: describe "garbage not collected in Velachery" and confirm the recommendation shows GCC channels with source dates.
2. Switch the language to தமிழ் and हिन्दी; the page text changes and `<html lang>` updates.
3. `/schemes`: search "rainwater harvesting"; records appear (an AI summary appears only if a key is configured).
4. `/my-complaints`: save a record from the Track step, open the private link in another browser, then delete it.

## Vercel

Not supported in this release: the records function depends on Netlify Blobs and the rate limits on Netlify's function config. Porting would need a different store (for example Vercel KV) and a rate-limit middleware.
