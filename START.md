# START

This is the first file an AI agent should read when beginning work.

## Mission

Build SEEK Apply Assistant into a safe desktop app for job seekers.

The app should help users apply faster, not spam employers.

## Read These Files First

1. `README.md`
2. `AGENTS.md`
3. `PRODUCT.md`
4. `ARCHITECTURE.md`
5. `SECURITY.md`
6. `AI_PROVIDER_STRATEGY.md`
7. `CODING_STANDARDS.md`
8. `TASKS.md`
9. `COMMANDS.md`

## First Implementation Target

If the repository only has scripts, start with:

```txt
Feature: Electron desktop shell
```

Acceptance criteria:
- App opens on macOS/Windows development environment.
- User can save/load config.
- User can select resume file.
- User can start existing `src/seek-apply.js`.
- User can stop running automation.
- Logs stream into UI.
- No API keys are hardcoded.
- No hidden browser automation is added.

## First Branch

```bash
git checkout -b feature/electron-desktop-shell
```

## First PR Summary Template

```md
## Summary
Added Electron desktop shell for controlling existing SEEK automation scripts.

## What changed
- Added desktop main process.
- Added preload bridge.
- Added renderer UI.
- Added config save/load.
- Added start/stop controls.
- Added log streaming.

## Testing
- Started desktop app locally.
- Saved config.
- Started automation.
- Stopped automation.
- Confirmed logs appear in UI.

## Risks
- Playwright browser packaging still needs production testing.
- SEEK selectors may need isolation in future PR.

## Follow-up
- Add AI settings screen.
- Add secure key storage.
- Add hosted AI backend.
```
