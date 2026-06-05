# Coding Standards

## General

Write boring, readable code.

Prefer:
- Small functions
- Clear names
- Explicit errors
- Simple modules
- Minimal dependencies
- User-friendly logs

Avoid:
- Clever abstractions
- Huge files
- Hidden side effects
- Silent failures
- Hardcoded selectors across many files

## JavaScript Style

- Use ES modules.
- Prefer `async/await`.
- Handle errors with useful messages.
- Avoid global mutable state except for controlled process state.
- Keep config loading separate from business logic.

## Electron Rules

- Keep Node access out of renderer.
- Use preload bridge.
- Use IPC handlers in main process.
- Validate IPC inputs.
- Never expose raw filesystem or shell access to renderer.
- Keep long-running automation in child process or controlled runner.

## Playwright Rules

- Keep selectors in `selectors.js`.
- Use visible browser mode by default.
- Add screenshots only for debugging, not always.
- Gracefully handle missing elements.
- Avoid brittle deep CSS selectors where possible.
- Prefer accessible locators when stable.
- Log each major step.

## AI Rules

- Keep prompts in `prompts.js`.
- Keep provider code isolated.
- Normalise provider responses into one internal shape.
- Add timeout handling.
- Add retry with strict max attempts.
- Never retry endlessly.
- Cache repeated outputs where appropriate.

## Config Rules

Good config structure:

```json
{
  "ai": {
    "mode": "hosted",
    "quality": "budget",
    "byokProvider": "openrouter",
    "byokModel": "deepseek/deepseek-chat"
  },
  "application": {
    "reviewBeforeSubmit": true,
    "maxApplicationsPerRun": 10
  }
}
```

Do not include secrets in this config.

## Error Messages

Bad:
```txt
Error: locator timeout
```

Good:
```txt
Could not find the Apply button. SEEK may have changed the page layout. Please open the job manually or update selectors.
```

## Testing Expectations

At minimum:
- App starts.
- Config saves and loads.
- Start button starts runner.
- Stop button stops runner.
- AI test connection works.
- BYOK invalid key shows friendly error.
- Hosted AI limit error shows friendly error.
- Already-applied jobs are skipped.
