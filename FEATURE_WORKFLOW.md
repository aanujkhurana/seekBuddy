# Feature Workflow

Use this process for every feature.

## 1. Create Issue

Every feature starts as a GitHub issue.

Issue must include:
- Problem
- User story
- Acceptance criteria
- Files likely to change
- Risk level
- Test plan

## 2. Create Branch

Use:

```bash
git checkout -b feature/name-of-feature
```

Examples:

```bash
git checkout -b feature/ai-settings
git checkout -b feature/hosted-ai-provider
git checkout -b feature/stop-automation
```

## 3. Implement Small

Keep the feature small enough to review.

Avoid combining:
- UI changes
- backend changes
- provider changes
- refactors

unless they are required.

## 4. Test

Run:
- install
- lint if available
- tests if available
- app startup
- manual scenario

## 5. Commit

Use clear commit messages:

```txt
feat: add AI settings screen
fix: stop automation gracefully
refactor: isolate SEEK selectors
docs: add provider strategy
```

## 6. Pull Request

PR description:

```md
## Summary
What changed?

## Why
Why was this needed?

## Testing
What was tested?

## Screenshots
For UI changes.

## Risks
What could break?

## Follow-up
What should be done later?
```
