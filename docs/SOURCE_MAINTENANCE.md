# Maintaining the Chennai civic knowledge base

CivicAssist gives citizens authority names, phone numbers and complaint links. If those are wrong, people waste time or give up. This guide explains how the facts are stored and how to keep them correct.

## Where the facts live

| File | Contents |
|---|---|
| `src/data/civic/source-registry.json` | Every official page that was opened, the date, what it confirmed (`findings`) and its `status`. |
| `src/data/civic/authorities.json` | Authorities, responsibilities, jurisdiction notes, letter recipients (designations and addresses only from official pages). |
| `src/data/civic/submission-channels.json` | Portals, phone numbers, WhatsApp, apps and email, with instructions in English, Tamil and Hindi. |
| `src/data/civic/complaint-types.json` | Complaint categories, multilingual keywords, primary and alternative authorities, follow-up questions, requested action. |
| `src/data/civic/escalation-rules.json` | Follow-up and escalation steps per authority. |

Status values:

- `verified`: the official page loaded and stated the fact.
- `loads`: the page loaded but the specific function (for example a JavaScript complaint form) could not be confirmed.
- `unreachable` (sources) / `unverified` (channels): the page could not be opened. The app labels these as not verified and never presents them as confirmed.

## Two kinds of checking

1. **Technical link check** (automated): `npx tsx scripts/validate-civic-sources.ts`
   - Checks every stored `https://` URL once, sequentially, with a 2-second pause and a 15-second timeout. Do not run it in a loop or more than about once a week.
   - Reports `accessible`, `redirect`, `broken` or `network_failure` and writes `data/source_check.json`.
   - `--strict` exits with an error if any URL is broken (for CI if wanted).
   - A 200 response does **not** prove a complaint form works or a phone line is staffed.
2. **Substantive verification** (manual, at least every 3 months and before any public launch):
   - Open each official page in a normal browser. Confirm the numbers, links and wording still match `findings`.
   - For portals, check whether login, OTP or an account is needed and update `requires`.
   - Call or message phone and WhatsApp channels only if appropriate; never file a test complaint with a real authority.
   - Update `checked` dates, `findings`, `status` and notes. Keep old facts out; do not guess.

## Adding or changing a fact

1. Open the official page (primary sources only: government domains, official apps).
2. Add or update the source in `source-registry.json` with today's date and the exact finding.
3. Reference the source id from the channel, authority or category.
4. Add the Tamil and Hindi text for any user-facing label or instruction (the integrity test fails otherwise). Mark new translations for native-speaker review.
5. Run `npx vitest run src/lib/civic` (schema and cross-reference checks) and the link check.

Never fill a missing phone number, address, designation or URL from memory, a news article or a search snippet. Leave it out and say it could not be verified.

## Known gaps (21 October 2026)

- Tamil Nadu Police and Chennai Traffic Police websites failed TLS checks, so no online police channel is listed (only 100, from the Tamil Nadu Government help-desk page).
- 112 could not be verified (official site unreachable); it is shown with a "not verified" label.
- No official response timelines were found for any authority.
- CMWSSB's complaint system and the CM Helpline portal are JavaScript applications whose forms could not be inspected automatically.
- The GCC headquarters postal address was not found on the pages checked; letters to GCC omit it.
- Ward and zone cannot be determined from an address; CivicAssist uses a ward only when the citizen states it.
