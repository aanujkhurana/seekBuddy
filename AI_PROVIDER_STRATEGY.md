# AI Provider Strategy

## Goal

Use cheap models by default while supporting higher-quality fallback and bring-your-own-key users.

## Modes

### Hosted Mode

The user logs into our app. Our backend calls AI providers using our API keys.

Pros:
- Best UX for non-technical users.
- No API setup for users.
- We can control cost and model quality.

Cons:
- We pay for usage.
- We need auth, limits, and abuse protection.

### Bring Your Own Key Mode

The user provides their own provider API key.

Pros:
- No AI cost for us.
- Useful for technical users.
- Supports advanced model choices.

Cons:
- Harder UX.
- Users may paste invalid keys.
- Requires secure local key storage.

## Supported Providers

Recommended V1:
- OpenRouter
- DeepSeek
- Gemini
- OpenAI

Recommended later:
- MiniMax direct
- Anthropic
- Groq
- Local Ollama

## Default Model Tiers

### Budget

Use for:
- Job summaries
- Basic cover letters
- Simple screening answers
- Job match scores

Possible providers:
- DeepSeek
- MiniMax through OpenRouter
- Gemini Flash or Flash Lite

### Balanced

Use for:
- Better cover letters
- More natural screening answers
- Resume alignment feedback

Possible providers:
- Gemini Flash
- stronger MiniMax model
- better DeepSeek model

### Premium

Use for:
- Harder applications
- Complex selection criteria
- Senior roles
- Final polishing

Possible providers:
- OpenAI mini or stronger model
- Gemini Pro-class model

## AI Task Types

```txt
job_summary
job_match_score
cover_letter
screening_answer
red_flag_detection
resume_keyword_match
application_review
```

## Routing Rules

Use cheapest acceptable model first.

```txt
cover_letter:
  1. DeepSeek or MiniMax
  2. Gemini Flash
  3. OpenAI mini fallback

screening_answer:
  1. DeepSeek or MiniMax
  2. Gemini Flash
  3. OpenAI mini fallback

job_match_score:
  1. DeepSeek
  2. Gemini Flash

red_flag_detection:
  1. Cheap model
  2. No premium fallback needed
```

## Cost Controls

Hosted mode must enforce:
- Daily generation limits.
- Max input characters.
- Max output tokens.
- Per-user rate limits.
- Cache repeated requests.
- No unlimited retries.
- No expensive model by default.

## Data Privacy

Before using hosted AI, clearly explain that:
- Resume text and job description may be sent to our backend.
- The data is used to generate job application content.
- Users can use BYOK mode if they prefer direct provider calls.
- Local-only mode should avoid hosted AI.

## Output Rules

AI must:
- Use only facts provided by the user.
- Avoid inventing experience.
- Keep writing concise and human.
- Use Australian English by default.
- Match the job description without keyword stuffing.

AI must not:
- Invent qualifications.
- Invent employment history.
- Invent visa status.
- Claim permanent residency or citizenship unless user provided it.
- Create misleading work rights statements.
