# Troubleshooting

## App Does Not Start

Try:
1. Reinstall the app.
2. Delete local app config.
3. Run from terminal in development mode.
4. Check logs.

## Browser Does Not Open

Possible causes:
- Playwright browser not installed.
- Antivirus blocked browser.
- App lacks permission.

Fix:
```bash
npm run install:browsers
```

## SEEK Login Does Not Work

The app should not bypass login security.

Try:
1. Open login manually.
2. Complete CAPTCHA or 2FA yourself.
3. Return to app after login.
4. Restart browser session if needed.

## Apply Button Not Found

Possible cause:
- SEEK changed page layout.
- Job uses external application page.
- Job is already applied.
- User is not logged in.

App should show:
```txt
Could not find the Apply button. Please review this job manually.
```

## AI Does Not Work

Hosted mode:
- Check login.
- Check daily limit.
- Check backend status.

BYOK mode:
- Check API key.
- Check selected provider.
- Press Test Connection.
- Check billing with provider.

## Stop Button Does Not Stop Immediately

Some steps may finish safely before stopping.

Expected:
- App should stop before next job.
- App should not submit while stopping.
- App should close browser or return to idle state.
