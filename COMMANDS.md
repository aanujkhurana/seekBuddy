# AI Agent Commands

These are command-style workflows for AI coding agents.

## /start

Purpose:
Prepare the repository and create the first actionable GitHub issue.

Steps:
1. Read project docs.
2. Inspect repository structure.
3. Identify missing setup.
4. Create a first issue for the smallest useful feature.
5. Create a feature branch.
6. Implement only that feature.
7. Run checks.
8. Prepare PR summary.

## /build

Purpose:
Implement a new feature.

Input:
- Feature name
- User problem
- Acceptance criteria

Rules:
- Create branch first.
- Keep scope tight.
- Do not refactor unrelated code.
- Add logs/errors where useful.
- Update docs if behaviour changes.
- Prepare PR description.

## /fix

Purpose:
Fix a bug.

Input:
- Bug description
- Expected behaviour
- Actual behaviour
- Reproduction steps if available

Rules:
- Reproduce or reason clearly.
- Make smallest fix.
- Add regression test if possible.
- Do not rewrite unrelated code.
- Explain root cause.

## /refactor

Purpose:
Improve structure without changing behaviour.

Rules:
- Preserve behaviour.
- Keep changes mechanical where possible.
- Do not mix with new features.
- Update imports.
- Run checks.

## /review

Purpose:
Review current branch before PR.

Check:
- Safety
- Secrets
- UX
- Error handling
- Logs
- Cost control
- Security
- Scope creep
- Tests

Output:
- Blockers
- Suggestions
- Approved items
- Risk summary
