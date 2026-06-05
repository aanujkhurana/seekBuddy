# SEEK Apply Assistant

A cross-platform desktop app that helps users manage SEEK job applications with safe automation, AI-assisted cover letters, screening answers, job matching, and local application history.

The app is designed for non-technical users. Users should be able to install the app, log in, configure job preferences, connect SEEK manually, choose AI mode, review applications, start automation, and stop anytime.

## Core Product Direction

This is not a spam bot.

The app should act as a job application assistant that helps users:
- Search and organise relevant jobs.
- Score jobs against their resume and preferences.
- Generate tailored cover letters.
- Draft screening question answers.
- Review before submitting.
- Track applied jobs locally.
- Stop automation at any time.

## Supported Platforms

- macOS
- Windows
- Linux

## Installation

### macOS

1. Download the `.dmg` file from the latest release.
2. Open the DMG and drag **Seek Apply Assistant** to your Applications folder.
3. On first launch, macOS may show a security warning. Open **System Preferences > Security & Privacy** and click **Open Anyway**.
4. The app will prompt you to install the Chromium browser engine (~150 MB). Click **Install Chromium**.

### Windows

1. Download the `.exe` installer from the latest release.
2. Run the installer. Windows Defender may show a SmartScreen warning — click **More info > Run anyway**.
3. Launch **Seek Apply Assistant** from the Start Menu.
4. The app will prompt you to install the Chromium browser engine. Click **Install Chromium**.

### Linux

1. Download the `.AppImage` from the latest release.
2. Make it executable: `chmod +x "Seek Apply Assistant-1.0.0.AppImage"`
3. Run the AppImage. The app will prompt you to install Chromium on first run.

## Building from Source

```bash
git clone <repo-url>
cd seekJobBuddy
npm install
npm run install:browsers
npm run desktop        # Run in development
npm run build:mac      # Build macOS DMG
npm run build:win      # Build Windows installer
```

## Main Stack

Desktop:
- Electron
- Node.js
- Playwright
- HTML/CSS/JavaScript or React later

Backend:
- Node.js
- Express
- Supabase Auth
- Supabase Postgres
- AI provider router
- Usage limits and billing-ready design

AI:
- Hosted AI through backend
- Bring Your Own Key mode
- Cheap model defaults
- OpenAI as optional premium fallback

## Non-Negotiables

- Never bundle the app owner’s API key in the desktop app.
- Never bypass CAPTCHA, 2FA, paywalls, bot detection, or security mechanisms.
- Never apply to unlimited jobs.
- Always provide a user-controlled stop button.
- Default to review-before-submit.
- Store sensitive keys in OS keychain where possible.
- Keep user credentials and resumes local unless the user explicitly uses hosted AI.
- Be transparent when AI sends resume/job data to the backend.
