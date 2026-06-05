# Product Specification

## Product Name

Working name: SEEK Apply Assistant

Alternative names:
- ApplyMate
- JobApply Runner
- SeekMate
- CareerPilot Desktop
- ApplyFlow

## Target User

Non-technical job seekers who want help applying to relevant jobs faster without learning APIs, scripts, or command-line tools.

## Core User Problems

Users struggle with:
- Repetitive job applications.
- Writing tailored cover letters.
- Answering screening questions.
- Tracking applied jobs.
- Filtering poor-fit jobs.
- Knowing which jobs match their resume.
- Staying consistent across applications.

## Product Promise

Install the app, connect SEEK, choose AI mode, review suggested applications, and apply faster while staying in control.

## MVP Features

### Desktop App
- Config screen
- SEEK login button
- Search preferences
- Resume file picker
- AI settings
- Start button
- Stop button
- Logs panel
- Applied history panel

### SEEK Automation
- Open visible browser
- Manual login support
- Search jobs
- Read job details
- Skip already-applied jobs
- Fill known fields
- Upload resume
- Pause for review
- Submit only after confirmation by default

### AI
- Job match score
- Job summary
- Cover letter draft
- Screening answer draft
- Red flag detection

### Safety
- Max applications per run
- Daily application limit
- Stop button
- Review-before-submit default
- Local logs

## V1 Defaults

```txt
Review before submit: true
Max applications per run: 10
Max hosted AI generations per day: 20
Browser mode: visible
AI mode: hosted budget
```

## Future Features

- Multiple job boards
- Resume tailoring
- Application analytics
- Stripe subscriptions
- Advanced AI model selection
- Cloud sync
- Chrome extension companion
- Saved answer templates
