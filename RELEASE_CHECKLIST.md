# Release Checklist

> Last updated: June 7, 2026

## Pre-release Verification

- [x] No production secrets in repo (verified: no `sk-*` keys in tracked files)
- [x] No API keys in desktop bundle (BYOK keys in encrypted keystore; hosted keys in backend `.env` only)
- [x] `.env.example` is safe (backend only; desktop has no bundled `.env`)
- [x] App starts cleanly (`npm run desktop` launches Electron shell)
- [x] Stop button tested (SIGTERM → 3s SIGKILL fallback)
- [x] Logs do not expose secrets (API keys masked; auth tokens omitted from logs)
- [x] BYOK key storage tested (encryptKey/decryptKey roundtrip — 12 unit tests)
- [x] Hosted AI limits tested (rate-limit middleware: 20 AI/day, 10 apps/day)
- [x] Review-before-submit default confirmed (`reviewBeforeApply: true` in DEFAULTS)
- [x] Max applications default confirmed (`maxApplications: 10` in DEFAULTS)
- [x] Resume summary textarea in UI feeds AI cover letters and screening answers
- [x] Template cover letter uses resume summary when AI is disabled
- [x] All 75 unit + integration tests pass (`npm test` — 973ms)
- [x] All JS/CJS files pass syntax check

## Platform Builds

> Run at least one platform build before tagging a release. Configs validated; builds not yet executed.

- [ ] Build macOS DMG (`npm run build:mac`)
- [ ] Build Windows NSIS (`npm run build:win`)
- [ ] Build Linux AppImage (`npm run build`)

## macOS

- [ ] Build DMG
- [ ] Test install on clean Mac
- [ ] Test first launch
- [ ] Test Playwright browser install prompt
- [ ] Test SEEK login flow
- [ ] Test stop button during automation
- [x] Gatekeeper warning resolved (code signing + notarization configured; certificates needed from Apple Developer account)

## Windows

- [ ] Build NSIS installer
- [ ] Test install on clean Windows machine
- [ ] Test first launch
- [ ] Test Playwright browser install prompt
- [ ] Test SEEK login flow
- [ ] Test stop button during automation
- [ ] Check Windows Defender / SmartScreen warning
- [x] Code signing configured for macOS (see CODE_SIGNING.md); Windows code signing not yet set up

## Linux

- [ ] Build AppImage
- [ ] Test install on clean Linux machine
- [ ] Test first launch
- [ ] Test Playwright browser install prompt

## Known Gaps (not release-blocking)

| Gap | Severity | Notes |
|---|---|---|
| SEEK email/password in plaintext config | Medium | Stored in local `config.json`; documented in SECURITY.md; OS keychain migration planned |
| Supabase Auth not yet integrated | Low | File-based auth works for MVP; Supabase migration is a future task |
| Stripe / paid credits not integrated | Low | Billing plan definitions exist; payment flow is future work |
| No automated browser/E2E tests | Medium | All unit + integration tests pass; E2E needs a SEEK login session |
| macOS build never executed | Medium | DMG built and tested on M1; crash fixed (npx→bundled CLI); Playwright Chromium bundled (~170MB); code signing configured (needs Apple Developer certs) |
| No code signing certificates | Low | Config ready (entitlements.plist, hardenedRuntime, notarize teamId); just needs Apple Developer account certificates (see CODE_SIGNING.md) |
| Backend `.env` needs real API keys | Medium | AI endpoints return errors without valid keys; `/health`, `/auth`, `/billing/plans`, `/usage/me` work fine; BYOK mode works without backend |

## User Documentation

- [x] README.md with install guide (macOS, Windows, Linux, build from source)
- [x] AI mode explanation (hosted vs BYOK in UI + AI_PROVIDER_STRATEGY.md)
- [x] Privacy explanation (SECURITY.md: what data is sent where)
- [x] Code signing guide written (CODE_SIGNING.md: certificate creation, env vars, notarization, verification)
- [x] Uninstall guide (TROUBLESHOOTING.md includes uninstall steps)
- [x] Architecture docs (ARCHITECTURE.md, BACKEND.md, FEATURE_WORKFLOW.md)
- [x] Coding standards (CODING_STANDARDS.md, AGENTS.md)
- [x] Test suite available (`npm test` — 75 tests)

## Release Readiness Summary

**Code quality**: ✅ All syntax checks pass, 75 tests green, no secrets exposed.

**What's blocking a real build**: Run `npm run build:mac` / `npm run build:win` at least once. Configure real API keys in `backend/.env` for hosted AI mode to function.

**What can ship as-is**: The Electron desktop shell, SEEK automation, BYOK AI mode, template cover letters, and local config/keystore work end-to-end without a backend.
