# Claude Code Instructions

Read this before making changes.

## Working Style

Before coding:
1. Read `README.md`.
2. Read `AGENTS.md`.
3. Read `PRODUCT.md`.
4. Read `ARCHITECTURE.md`.
5. Read relevant files in `docs/commands`.

When coding:
- Create a feature branch before changes.
- Keep commits small and focused.
- Do not rewrite unrelated files.
- Do not change app behaviour without documenting why.
- Prefer minimal working implementation over large rewrites.
- After changes, run available tests or at least syntax checks.
- Summarise what changed, what was tested, and what still needs review.

## Branch Rules

Use branch names like:

```txt
feature/ai-settings
fix/playwright-stop-handler
refactor/provider-router
docs/update-agent-guides
```

## Pull Request Rules

Every PR must include:
- What changed
- Why it changed
- How it was tested
- Screenshots for UI changes
- Known risks
- Follow-up tasks

## Code Quality Rules

- Keep provider-specific AI code isolated.
- Keep SEEK selectors isolated.
- Keep Electron IPC handlers small.
- Keep secrets out of renderer code.
- Do not expose Node APIs directly to renderer.
- Use preload bridge for safe IPC.
- Use OS keychain for BYOK secrets where possible.
- Avoid storing passwords in plaintext.

## Hard Stop Conditions

Stop and ask for human review if a task requires:
- CAPTCHA bypass
- 2FA bypass
- Obfuscating automation
- Sending applications without user confirmation by default
- Hardcoding production API keys
- Collecting sensitive user data without clear consent
