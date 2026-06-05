# Agent Task Backlog

> Last updated: June 5, 2026 | Status: 7 phases complete, release prep phase

## Phase 1: Desktop Shell ✅

- [x] Create Electron app shell.
- [x] Add settings screen.
- [x] Add start/stop controls.
- [x] Add logs panel.
- [x] Add local config save/load.
- [x] Add file picker for resume.
- [x] Add applied jobs history file.
- [x] Add resume summary textarea (feeds AI cover letters).

## Phase 2: SEEK Automation ✅

- [x] Open visible Playwright browser.
- [x] Add manual login flow.
- [x] Add search configuration.
- [x] Extract job cards.
- [x] Extract job detail page.
- [x] Skip already-applied jobs.
- [x] Fill basic application fields.
- [x] Add review-before-submit.
- [x] Add stop controller.

## Phase 3: AI Foundation ✅

- [x] Add AI settings screen.
- [x] Add hosted mode.
- [x] Add BYOK mode.
- [x] Add provider interface (ai-client.js).
- [x] Add OpenRouter provider.
- [x] Add DeepSeek provider.
- [x] Add Gemini provider.
- [x] Add OpenAI provider.
- [x] Add MiniMax provider.
- [x] Add AI test connection.
- [x] Add hosted auto-registration flow.
- [x] Add encrypted keystore for BYOK keys.

## Phase 4: AI Features ✅

- [x] Generate cover letter (AI + template fallback).
- [x] Generate screening answers.
- [x] Score job match.
- [x] Detect red flags.
- [x] Summarise job ad.
- [x] Cache repeated AI generations.
- [x] Unified ai-service.js with normalizeResumeSummary.
- [x] Resume summary feeds cover letters and screening answers.

## Phase 5: Backend ✅

- [x] Add Express backend.
- [ ] ~~Add Supabase Auth~~ → Deferred (file-based auth works for MVP).
- [x] Add usage limits.
- [x] Add AI router with provider fallback chain.
- [x] Add per-provider timeouts (15s).
- [x] Add request logging (method, path, status, duration).
- [x] Add AI response cache.
- [x] Add all hosted AI endpoints (test, cover-letter, screening-answer, job-match, red-flags, summarize, generate).
- [x] Add /health endpoint.
- [x] Add /usage/me dashboard endpoint.
- [x] Export app for testability (isMainModule guard).

## Phase 6: Packaging ✅

- [x] Add electron-builder config (DMG, NSIS, AppImage).
- [ ] Build macOS DMG — config valid, not yet executed.
- [ ] Build Windows installer — config valid, not yet executed.
- [x] Add first-run browser install prompt (main.js promptInstallBrowsers).
- [x] Add README install guide (macOS, Windows, Linux, build from source).
- [x] Add basic support docs (TROUBLESHOOTING.md, SECURITY.md).

## Phase 7: Commercialisation ✅

- [x] Add usage dashboard UI (generations, applications, cost, tasks).
- [ ] ~~Add Stripe integration~~ → Deferred (plan definitions exist; payment flow is future work).
- [x] Add billing plan definitions (/billing/plans — free + pro).
- [x] Add referral code system (generate + apply, 5-use cap).
- [x] Add crash/error reporting (local crash-log.json + backend /crash/report).

## Phase 8: Testing (current)

- [x] Unit tests: ai-service.js (38 tests — cover letter, screening, scoring, red flags, summarization).
- [x] Unit tests: desktop config-utils.js (23 tests — DEFAULTS, mergeConfig, encryptKey/decryptKey).
- [x] Integration tests: backend routes (14 tests — /health, /auth/register, /auth/me, /billing/plans, auth protection).
- [x] `npm test` runs all 75 tests in ~1s.
- [ ] Build and run macOS DMG.
- [ ] E2E browser dry-run with SEEK login session.

## Remaining Gaps

| Gap | Phase | Notes |
|---|---|---|
| SEEK password in plaintext config | 1 | Security concern; OS keychain migration planned |
| Supabase Auth | 5 | File-based auth works; migrate later |
| Stripe payments | 7 | Plan definitions exist; integrate with Stripe SDK |
| macOS DMG build | 6 | electron-builder config valid; `npm run build:mac` not run |
| Windows NSIS build | 6 | electron-builder config valid; `npm run build:win` not run |
| Real API keys in backend/.env | 5 | Needed for hosted AI mode to function |
| Code signing certificates | 6 | Needed to avoid Gatekeeper/SmartScreen warnings |
| E2E browser tests | 8 | Requires SEEK login session |
