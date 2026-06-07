# macOS Code Signing & Notarization

This guide covers setting up code signing for the Seek Apply Assistant
Electron app so it passes Gatekeeper without warnings on macOS.

## Prerequisites

You need an **Apple Developer Program** membership ($99/year).

### Step 1: Create a Developer ID Application certificate

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles** → **Certificates**
3. Click **+** → **Developer ID Application** → Continue
4. Generate a Certificate Signing Request (CSR) from Keychain Access:
   ```
   Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
   ```
   - User Email: your Apple ID email
   - Common Name: your name
   - Saved to disk
5. Upload the CSR file → Download the `.cer` certificate
6. Double-click the `.cer` file to install it in your keychain

### Step 2: Export the certificate as .p12

1. Open **Keychain Access** → **login** keychain → **My Certificates**
2. Find your **Developer ID Application** certificate
3. Right-click → **Export** → `.p12` format
4. Set a strong password — this is `CSC_KEY_PASSWORD`

### Step 3: Generate an app-specific password for Apple ID

1. Go to [appleid.apple.com](https://appleid.apple.com) → **Sign-In and Security** → **App-Specific Passwords**
2. Generate a new password named "Electron Builder Notarization"
3. Save the generated password — this is `APPLE_APP_SPECIFIC_PASSWORD`

### Step 4: Get your Team ID

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. Your Team ID is shown under your name/org name in the Membership section
3. This is `APPLE_TEAM_ID`

## Environment Variables

Set these before running the build. Do **NOT** hardcode them or commit them.

```bash
export CSC_LINK="/path/to/your-certificate.p12"
export CSC_KEY_PASSWORD="your-p12-password"
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

### Using a .env file (do not commit)

Create a file at the project root named `.env.signing`:

```bash
CSC_LINK=~/Desktop/DeveloperIDApplication.p12
CSC_KEY_PASSWORD=your-p12-password
APPLE_ID=you@email.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=YOUR_TEAM_ID
```

Then source it before building:

```bash
source .env.signing
npm run build:mac
```

## Build the Signed & Notarized App

```bash
# Set env vars (see above), then:
npm run build:mac
```

electron-builder will:
1. Sign the `.app` bundle with your Developer ID certificate
2. Upload it to Apple's notary service
3. Staple the notarization ticket to the app
4. Package everything into a DMG

## Verify Signing & Notarization

```bash
# Check code signature
codesign -dvvv "dist/mac-arm64/Seek Apply Assistant.app"

# Check notarization stapler
xcrun stapler validate "dist/mac-arm64/Seek Apply Assistant.app"

# Check Gatekeeper assessment
spctl --assess --verbose "dist/mac-arm64/Seek Apply Assistant.app"
```

All three should pass without errors.

## Troubleshooting

### "code object is not signed at all"
The certificate wasn't applied. Check that `CSC_LINK` points to a valid `.p12` file and `CSC_KEY_PASSWORD` is correct.

### "The binary is not signed with a Developer ID certificate"
The wrong certificate type is in your keychain. Make sure it's a **Developer ID Application** certificate, not an Apple Development certificate.

### "Unable to notarize - You must first sign"
The `hardenedRuntime: true` setting is required. Verify it's in `package.json` under `build.mac`.

### "Too many notarization requests"
Apple rate-limits notarization. Wait a few minutes and retry, or use `electron-builder --mac --publish=never` to skip notarization during testing.

### "The app cannot be opened because the developer cannot be verified"
The notarization didn't staple. Run:
```bash
xcrun stapler staple "dist/mac-arm64/Seek Apply Assistant.app"
```
Then rebuild the DMG.

## CI/CD (GitHub Actions)

For automated builds, use GitHub Secrets:

```yaml
- name: Build macOS app
  env:
    CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: npm run build:mac
```

Store the `.p12` file as a base64-encoded secret:
```bash
base64 -i DeveloperIDApplication.p12 | pbcopy
# Paste into GitHub Secret MAC_CSC_LINK
```
