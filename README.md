# CivicAssist

Municipal grievance handling for Greater Chennai Corporation (demo data only).

A citizen types a complaint in plain language and CivicAssist:

1. **Triages it** without any language model: department, ward, issue, urgency, repeat detection and PII masking (`src/lib/nlp/`).
2. **Answers "which scheme applies to me?"** only from the 148-entry knowledge base (`public/data/schemes.json`), always showing the scheme number, name, PDF page and official source. If nothing relevant is retrieved it says the answer is not in its documents, without calling the model.
3. **Drafts an acknowledgement letter** for an officer to approve and exports it as a PDF.
4. Shows an **officer dashboard** and a measured **evaluation** page.

## Run locally

```bash
npm install
cp .env.example .env   # add GEMINI_API_KEY and/or GROQ_API_KEY (optional)
netlify dev            # http://localhost:8888
```

Without API keys, triage and search still work. Advisory shows the matching records without a written answer, and letters use a rule-safe template.

## Data pipeline

```bash
npx tsx scripts/parse_schemes.ts      # PDF -> public/data/schemes.json (one record per entry)
npx tsx scripts/build_index.ts        # embeddings -> public/data/index.json
npx tsx scripts/gen_complaints.ts     # 200 synthetic complaints -> data/complaints.csv
npx tsx scripts/train_classifier.ts   # Naive Bayes -> src/lib/nlp/model.json
npx tsx scripts/pipeline.ts           # triage all -> public/data/triaged.json
node --env-file-if-exists=.env --import tsx eval/run.ts   # -> public/data/eval_report.json
npx vitest run
```

## Deploy to Netlify

1. app.netlify.com → **Add new site → Import an existing project → GitHub** → pick this repo, branch `main`.
2. Build settings come from `netlify.toml` (build `npm run build`, publish `dist`, functions `netlify/functions`).
3. **Site configuration → Environment variables**: add `GEMINI_API_KEY` and `GROQ_API_KEY` (scope: Functions), then redeploy.

API keys are read only in `netlify/functions/llm.ts`. They are never sent to the browser and never committed.

## CI

- `.github/workflows/pipeline.yml` (push / pull request): tests, parse, index, triage, build, then commits refreshed `public/data/`.
- `.github/workflows/eval.yml` (manual): runs the evaluation using the `GEMINI_API_KEY` / `GROQ_API_KEY` repository secrets.
