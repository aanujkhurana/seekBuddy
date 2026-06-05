# Backend Specification

## Purpose

The backend powers hosted AI mode, user accounts, usage limits, and future billing.

## Stack

Recommended:
- Node.js
- Express
- Supabase Auth
- Supabase Postgres
- OpenRouter / DeepSeek / MiniMax / Gemini / OpenAI
- Stripe later

## Endpoints

### Auth

```txt
POST /auth/session
GET /auth/me
```

If using Supabase Auth directly from client, backend should validate Supabase JWT.

### AI

```txt
POST /ai/cover-letter
POST /ai/screening-answer
POST /ai/job-match-score
POST /ai/red-flags
POST /ai/test
```

### Usage

```txt
GET /usage/me
```

## Request Shape

```json
{
  "task": "cover_letter",
  "resumeText": "",
  "jobDescription": "",
  "jobTitle": "",
  "companyName": "",
  "question": "",
  "userPreferences": {}
}
```

## Response Shape

```json
{
  "success": true,
  "model": "budget",
  "result": "",
  "usage": {
    "dailyUsed": 4,
    "dailyLimit": 20
  }
}
```

## Database Tables

### profiles

```txt
id
email
plan
created_at
```

### ai_usage

```txt
id
user_id
task
model
input_tokens_estimate
output_tokens_estimate
cost_estimate
created_at
```

### ai_cache

```txt
id
user_id
task
input_hash
output
model_used
created_at
```

### usage_limits

```txt
id
user_id
daily_generation_limit
daily_application_limit
premium_enabled
created_at
updated_at
```

## Usage Limit Defaults

```txt
free_friend:
  ai_generations_per_day: 20
  applications_per_day: 10
  max_input_chars: 8000
  max_output_tokens: 1200
```

## AI Router

The backend should:
1. Validate user.
2. Check limit.
3. Check cache.
4. Select cheapest model.
5. Call provider.
6. Save usage.
7. Return output.

## Error Responses

```json
{
  "success": false,
  "code": "DAILY_LIMIT_REACHED",
  "message": "You have reached today's built-in AI limit. Try again tomorrow or switch to your own API key."
}
```
