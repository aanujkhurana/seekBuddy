# Architecture

## High-Level Architecture

```txt
Electron Desktop App
  |
  | Local config, browser automation, user interface
  |
  +--> Playwright visible browser for SEEK
  |
  +--> AI Client
        |
        +--> Hosted mode: your backend
        |
        +--> BYOK mode: user's provider API directly
```

## Hosted AI Architecture

```txt
Desktop App
  |
  | HTTPS request with user auth token
  v
Backend API
  |
  | Validates user and usage limits
  v
AI Router
  |
  | Calls cheap model provider
  v
DeepSeek / MiniMax / Gemini / OpenRouter / OpenAI
```

## Main Desktop Modules

```txt
desktop/
  main.js
  preload.js
  renderer/
    index.html
    app.js
    styles.css

src/
  seek-apply.js
  seek-login.js
  clear-applied.js

  automation/
    browser.js
    runner.js
    selectors.js
    job-reader.js
    application-filler.js
    stop-controller.js
    logger.js
    config.js

  ai/
    ai-client.js
    prompts.js
    providers/
      hosted-provider.js
      openrouter-provider.js
      deepseek-provider.js
      gemini-provider.js
      openai-provider.js

  storage/
    applied-jobs.js
    user-config.js
    secure-secrets.js
```

## Backend Modules

```txt
backend/
  src/
    app.js
    routes/
      auth.routes.js
      ai.routes.js
      usage.routes.js
    services/
      ai-router.js
      usage-limits.js
      cache.js
      cost-logger.js
    providers/
      openrouter.js
      deepseek.js
      minimax.js
      gemini.js
      openai.js
    middleware/
      require-auth.js
      rate-limit.js
```

## Data Flow: Cover Letter

```txt
User selects job
App extracts job description
App reads resume text
App creates AI payload
If hosted mode:
  Send to backend
  Backend checks usage
  Backend calls model
  Backend returns draft
If BYOK mode:
  App calls selected provider directly
App shows draft to user
User edits or accepts
App fills field
User confirms submission
```

## Secrets

Never store owner API keys in the desktop app.

Hosted mode:
- Provider keys live only on backend environment variables.

BYOK mode:
- User keys are stored in OS keychain.
- Config JSON stores provider and model, not secret key.

## Logging

Logs should be user-readable.

Good:
```txt
Found 12 jobs.
Skipping job already applied: Frontend Developer.
Generated cover letter draft.
Waiting for user review.
```

Bad:
```txt
Selector .xyz failed at node handle 127
Unhandled promise rejection
```
