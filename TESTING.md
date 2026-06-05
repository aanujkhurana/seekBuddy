# Testing Guide

## Manual Test Checklist

### Desktop App

- [ ] App opens.
- [ ] Config saves.
- [ ] Config loads after restart.
- [ ] Resume file can be selected.
- [ ] Start button launches automation.
- [ ] Stop button stops automation.
- [ ] Logs appear in UI.
- [ ] Clear applied history works.
- [ ] Invalid config shows friendly error.

### SEEK Flow

- [ ] Browser opens visibly.
- [ ] User can login manually.
- [ ] App waits for login.
- [ ] Search page opens.
- [ ] Job cards are detected.
- [ ] Already-applied jobs are skipped.
- [ ] Stop button works during scan.
- [ ] Stop button works during application flow.

### AI Hosted Mode

- [ ] User must be authenticated.
- [ ] Cover letter generation works.
- [ ] Screening answer generation works.
- [ ] Usage limit is enforced.
- [ ] Limit error is friendly.
- [ ] Provider failure uses fallback.
- [ ] No provider API key appears in desktop logs.

### AI BYOK Mode

- [ ] User can select provider.
- [ ] User can enter API key.
- [ ] API key is masked.
- [ ] Test connection works.
- [ ] Invalid key shows friendly error.
- [ ] Key can be deleted.
- [ ] Key is not stored in config JSON.

## Suggested Automated Tests

- Config load/save.
- AI provider response normalisation.
- Usage limit calculation.
- Cache key creation.
- Applied job deduplication.
- Prompt builder does not include undefined fields.
