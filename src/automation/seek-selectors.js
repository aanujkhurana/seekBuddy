export const SEEK_SELECTORS = {
  jobLinks: 'a[href]',
  jobDetail: {
    title: [
      "h1",
      '[data-automation="job-detail-title"]',
      '[data-automation="job-title"]'
    ],
    company: [
      '[data-automation="advertiser-name"]',
      '[data-automation="company-name"]',
      'a[href*="/companies/"]'
    ],
    description: [
      '[data-automation="jobAdDetails"]',
      '[data-automation="jobDescription"]',
      "article",
      "main"
    ],
    location: [
      '[data-automation="job-detail-location"]',
      '[data-automation="job-location"]',
      '[data-automation="job-detail-area"]'
    ]
  },
  applyControls: [
    'a[href*="apply"]',
    'button:has-text("Apply")'
  ],
  resumeUploadInput: 'input[type="file"]',
  coverLetterFields: [
    'textarea[name*="cover" i]',
    'textarea[id*="cover" i]',
    'textarea[aria-label*="cover" i]',
    'textarea[placeholder*="cover" i]',
    'textarea[name*="message" i]',
    'textarea[aria-label*="message" i]',
    "textarea"
  ],
  editableField: '[contenteditable="true"]'
};

export const SEEK_TEXT = {
  jobPath: /\/job\/\d+/,
  seekHost: /seek\.com/i,
  humanVerification: /just a moment|confirm you are human/i,
  signInUrl: /login\.seek\.com|\/oauth\/login|#\/login/i,
  signInPage: /sign in to seek|sign in.*apply|email.*password/i,
  alreadyApplied: /\balready applied\b|\byou applied\b|\bapplication submitted\b|\byour application has been submitted\b/i,
  applyControlName: /^apply/i,
  resumeUploadControlName: /resume|upload|attach/i
};
