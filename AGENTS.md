# Agent Notes

## Project

This repository automates assisted SEEK job applications with Playwright. It opens SEEK, uses a persistent browser profile for login state, drafts cover letters, attempts to attach a resume, and pauses before final submission.

## Important Commands

- `npm install` installs Node dependencies.
- `npm run install:browsers` downloads the Chromium browser required by Playwright.
- `npm run login` opens SEEK and saves the browser session in `.playwright-seek-profile`.
- `npm run apply` searches and starts application flows based on `config.json`.

## Local Files

- `config.json` is user-specific and intentionally ignored by Git.
- `.playwright-seek-profile/` stores login/session state and is ignored by Git.
- `data/` and `out/` are generated runtime output and are ignored by Git.
- `config.example.json` is the safe template to update when config shape changes.

## Safety

- Do not automate final application submission.
- Do not attempt to bypass CAPTCHA, anti-bot checks, paywalls, or site restrictions.
- Treat resume paths, applicant details, generated cover letters, and browser profiles as private.
