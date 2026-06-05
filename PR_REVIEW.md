# PR Review Checklist

## Product

- [ ] Solves the stated user problem.
- [ ] Does not add unnecessary complexity.
- [ ] Keeps non-technical users in mind.
- [ ] Has clear user-facing errors.

## Safety

- [ ] No CAPTCHA bypass.
- [ ] No 2FA bypass.
- [ ] No hidden automation.
- [ ] No unlimited applications.
- [ ] Stop button still works.
- [ ] Review-before-submit remains default.

## Security

- [ ] No API keys in desktop app.
- [ ] No secrets in logs.
- [ ] No passwords in plaintext config.
- [ ] Renderer has no raw Node access.
- [ ] IPC inputs are validated.

## AI

- [ ] AI does not invent experience.
- [ ] Hosted mode goes through backend.
- [ ] BYOK keys are handled securely.
- [ ] Usage limits are respected.
- [ ] Prompt outputs are bounded.

## Code

- [ ] Scope is focused.
- [ ] Modules are small.
- [ ] Errors are handled.
- [ ] Logs are useful.
- [ ] No unrelated refactors.
- [ ] No dead code.

## Testing

- [ ] App starts.
- [ ] Main flow tested.
- [ ] Edge cases considered.
- [ ] Manual testing notes included.
