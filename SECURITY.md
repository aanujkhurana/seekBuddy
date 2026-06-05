# Security Rules

## Core Principle

Treat the desktop app as public. Anything bundled into the app can be extracted.

## Secrets

Never include these in the desktop app:
- OpenAI API key
- DeepSeek API key
- MiniMax API key
- Gemini API key
- OpenRouter API key
- Supabase service role key
- Backend admin tokens
- Stripe secret key

## Hosted AI Secrets

Provider API keys must live only in backend environment variables.

Example:

```env
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

## BYOK Secrets

When users provide their own API key:
- Store it using OS keychain.
- Do not store it in plaintext config files.
- Mask it in UI.
- Provide delete/reset option.
- Provide test connection option.

Use `keytar` or platform-native credential storage.

## SEEK Credentials

Preferred approach:
- Do not store SEEK password.
- Let users log in manually in a visible browser.
- Reuse browser session storage where possible.

If credential storage is added later:
- Use OS keychain.
- Make it optional.
- Clearly explain risk.
- Never send SEEK credentials to backend.

## Browser Automation

Do not:
- Bypass CAPTCHA.
- Bypass 2FA.
- Hide browser behaviour to avoid detection.
- Rotate identities or fake fingerprints.
- Add anti-detection evasion tooling.

Do:
- Use visible browser mode.
- Let users manually complete login.
- Add delays that look natural because the app is user-controlled, not to evade detection.
- Keep application limits strict.

## Resume and Job Data

Hosted AI mode may send:
- Resume text
- Job description
- Role title
- Company name
- Screening question

Do not send:
- SEEK password
- Browser cookies
- Unrelated local files
- Full browsing history

## Backend Protection

Backend must implement:
- Authentication
- Rate limiting
- Usage limits
- Input size limits
- Request logging
- Abuse detection
- CORS restrictions
- Error sanitisation

## Logging

Do not log:
- API keys
- SEEK passwords
- Auth tokens
- Full resumes by default
- Browser cookies

Safe logs:
- Model used
- Token estimate
- Task type
- Success/failure
- Timestamp
- User ID
