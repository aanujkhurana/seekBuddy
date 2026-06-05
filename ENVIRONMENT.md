# Environment Variables

## Desktop App

Desktop app should not contain production secrets.

Allowed:
```env
VITE_BACKEND_URL=
APP_ENV=development
```

Not allowed:
```env
OPENAI_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
```

## Backend

Required backend variables:

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=

AI_DEFAULT_TIER=budget
AI_DAILY_FREE_LIMIT=20
AI_MAX_INPUT_CHARS=8000
AI_MAX_OUTPUT_TOKENS=1200

CORS_ORIGIN=
```

## Local Development

Use:

```txt
.env.local
```

Never commit real `.env` files.

Commit only:

```txt
.env.example
```
