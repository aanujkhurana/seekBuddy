# SEEK Job Application Automation

This project opens SEEK, searches for a job title/location, drafts a custom cover letter from the job ad, attaches your resume when possible, leaves prepared application tabs open, and pauses once at the end for review/submission.

It intentionally does **not** click the final submit/apply button automatically. Job application forms vary, often include employer-specific questions, and you should review every application before sending it.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Install the Playwright browser:

```bash
npm run install:browsers
```

If `npm run login` fails with `browserType.launchPersistentContext: Executable doesn't exist`,
run `npm run install:browsers` again. This downloads the browser binary that matches the
installed Playwright package.

3. Edit your private `config.json` and set:

- `jobTitle`
- `location`
- `resumePath` as an absolute path
- `applicant`
- `resumeSummary`

`jobTitle` and `location` can each be comma-separated when you want to search multiple
terms or places. For example, `"Frontend Developer, Software Engineer"` and
`"Gold Coast, Brisbane QLD"` will run separate searches and merge the results.

The default cover-letter tone is humanized, friendly, fun, and professional.
You can tune it with `coverLetter.tone`.

Optional AI cover letters:

Edit your private `.env` and set `OPENAI_API_KEY`. The `.env` file is ignored by Git.

Then set:

```json
"openai": {
  "enabled": true,
  "model": "gpt-5-mini",
  "timeoutMs": 60000
}
```

You can change the model to any text-capable OpenAI model your account can use.
The default is `gpt-5-mini`, a lower-cost model that is still strong for well-prompted cover letters.
`timeoutMs` controls how long the script waits for OpenAI before falling back to the template cover letter.

## Log In To SEEK

Run this once:

```bash
npm run login
```

A browser will open. Log in to SEEK, then return to the terminal and press Enter. The session is saved in `.playwright-seek-profile`.

## Run

```bash
npm run apply
```

To clear the handled/applied job history and start fresh:

```bash
npm run clear:applied
```

The script will:

- Search SEEK for your configured job title/location combinations.
- Select the first `maxApplications` job ads for each title/location search.
- Click into the apply flow where possible.
- Generate and save cover letters in `out/cover-letters` only after an apply page with a cover-letter field is available.
- Attach your resume if a file upload is available.
- Fill a cover-letter field if one is present.
- Leave prepared application tabs open and pause once after the batch so you can review/submit manually.

## Safety Notes

- Do not use this to bypass CAPTCHA, bot checks, paywalls, or site restrictions.
- Review each application before submitting.
- Some SEEK listings redirect to employer websites. The script will stop and let you handle those manually when it cannot confidently fill the form.
