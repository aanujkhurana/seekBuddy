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

`npm run build:mac` intentionally fails if Developer ID signing or Apple
notarization credentials are missing. This prevents accidentally sharing a DMG
that opens on the build Mac but fails on another Mac after AirDrop/download.

electron-builder will:
1. Sign the `.app` bundle with your Developer ID certificate
2. Upload it to Apple's notary service
3. Staple the notarization ticket to the app
4. Package everything into a DMG

For local-only testing, use:

```bash
npm run build:mac:unsigned
```

Do not send unsigned builds to other users.

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

### "The app is damaged/corrupted and cannot be opened. Move to Bin"
This usually means macOS Gatekeeper is rejecting a quarantined copy because the
app is unsigned, incorrectly signed, or not notarized. AirDrop and browser
downloads add quarantine metadata, so an app can open on the build Mac but fail
on a friend's Mac.

Check the installed app/DMG:

```bash
codesign --verify --deep --strict --verbose=4 "dist/mac-arm64/Seek Apply Assistant.app"
xcrun stapler validate "dist/Seek Apply Assistant-1.0.0-arm64.dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 "dist/Seek Apply Assistant-1.0.0-arm64.dmg"
```

The real fix is to build with a **Developer ID Application** certificate and
successful notarization:

```bash
source .env.signing
npm run build:mac
```

As a temporary local workaround only, the recipient can remove quarantine:

```bash
xattr -dr com.apple.quarantine "/Applications/Seek Apply Assistant.app"
```

Do not use the quarantine workaround for public distribution.

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

---

# Windows Code Signing

This guide covers setting up code signing for the Seek Apply Assistant
NSIS installer so it avoids SmartScreen warnings on Windows.

## Prerequisites

You need a **Code Signing Certificate** from a trusted Certificate Authority:

- **EV (Extended Validation)**: Recommended for immediate SmartScreen trust. Requires a physical hardware token (USB key) or cloud HSM. No reputation-building needed — SmartScreen trusts EV-signed apps immediately.
- **OV (Organization Validation)**: Cheaper option (~$200–400/year vs $400–700 for EV). Requires building reputation over time (hundreds to thousands of installs before SmartScreen stops warning).

**Where to buy:** DigiCert, Sectigo (formerly Comodo), GlobalSign, or SSL.com.

## Step-by-Step Setup

### Step 1: Purchase and validate the certificate

1. Buy an EV or OV Code Signing Certificate from a CA
2. Complete the CA's organization validation process (D-U-N-S number, business registration, phone verification)
3. For EV: receive a hardware token (USB key) with the certificate pre-installed
4. For OV: download the certificate after validation completes

### Step 2: Export the certificate as .pfx (OV only)

If using an OV certificate (file-based):

1. Open **certmgr.msc** (Windows) or use the CA's management tool
2. Find your certificate under **Personal → Certificates**
3. Right-click → **All Tasks → Export**
4. Choose **Yes, export the private key**
5. Format: **Personal Information Exchange (.pfx)**
6. Set a strong password — this is `CSC_KEY_PASSWORD`
7. Save as `code-signing-certificate.pfx`

If using an EV certificate on a hardware token, you'll need a cloud signing service (Azure Key Vault, SSL.com eSigner) or sign via `signtool.exe` directly — see the Azure Key Vault section below.

## Environment Variables

Set these before running the build. Do **NOT** hardcode them or commit them.

### Shared env vars (used by both macOS and Windows)

```bash
export CSC_LINK="/path/to/code-signing-certificate.pfx"
export CSC_KEY_PASSWORD="your-pfx-password"
```

### Windows-specific overrides (optional)

Use these if your Windows certificate differs from macOS:

```bash
export WIN_CSC_LINK="/path/to/windows-specific-certificate.pfx"
export WIN_CSC_KEY_PASSWORD="your-windows-pfx-password"
```

`WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` take precedence over `CSC_LINK`/`CSC_KEY_PASSWORD` for Windows builds.

### Using a .env file (do not commit)

Add Windows signing vars to `.env.signing`:

```bash
# macOS
CSC_LINK=~/Desktop/DeveloperIDApplication.p12
CSC_KEY_PASSWORD=your-p12-password
APPLE_ID=you@email.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=YOUR_TEAM_ID

# Windows (uses same CSC_LINK/CSC_KEY_PASSWORD by default;
# uncomment WIN_ prefixed vars to override)
# WIN_CSC_LINK=~/Desktop/code-signing-certificate.pfx
# WIN_CSC_KEY_PASSWORD=your-windows-pfx-password
```

## Build the Signed Windows Installer

```bash
# Set env vars (see above), then:
npm run build:win
```

electron-builder will:
1. Sign the `.exe` and all bundled binaries with SHA-256
2. Apply an RFC 3161 timestamp from DigiCert
3. Package everything into the NSIS installer (also signed)

## Verify Signing

On a Windows machine (or using `osslsigncode` on macOS/Linux):

```bash
# Check digital signature (Windows)
signtool verify /pa /v "dist/Seek Apply Assistant Setup 1.0.0.exe"

# Check digital signature (macOS/Linux with osslsigncode)
brew install osslsigncode
osslsigncode verify "dist/Seek Apply Assistant Setup 1.0.0.exe"
```

Expected output: `Succeeded` or `Signature verification: OK`.

## SmartScreen Reputation

| Certificate Type | SmartScreen Behavior | Time to Trust |
|---|---|---|
| **EV** | No warnings from day one | Immediate |
| **OV** | "Windows protected your PC" warning | Weeks to months, depends on install volume |
| **None** | "Windows protected your PC" + "Unknown publisher" | Never fully trusted |

### Building reputation for OV certificates

- SmartScreen uses cumulative install volume as a trust signal
- Typically needs hundreds to thousands of successful installs
- Each signed build shares the same certificate, so reputation accumulates
- Submit your app to Microsoft for malware analysis: [Microsoft Security Intelligence](https://www.microsoft.com/en-us/wdsi/filesubmission)

## Azure Key Vault / Cloud Signing

If using an EV certificate stored in Azure Key Vault or a cloud signing service:

```bash
# electron-builder doesn't natively support Azure Key Vault,
# but you can use a custom sign script via the win.sign option.

# 1. Install Azure Sign Tool
dotnet tool install --global AzureSignTool

# 2. Create a sign.cmd script:
@echo off
AzureSignTool sign -kvu "%AZURE_KEY_VAULT_URI%" -kvi "%AZURE_CLIENT_ID%" -kvs "%AZURE_CLIENT_SECRET%" -kvc %AZURE_CERT_NAME% -tr http://timestamp.digicert.com -td sha256 %*

# 3. Add to package.json:
# "win": {
#   "sign": "./scripts/sign.cmd"
# }
```

## Troubleshooting

### "The file is not digitally signed"
Check that `CSC_LINK` points to a valid `.pfx`/`.p12` file and `CSC_KEY_PASSWORD` is correct.

### "The certificate is not trusted"
The certificate chain is incomplete. Make sure the CA's intermediate certificates are included in the `.pfx` export.

### "SignTool Error: No certificates were found"
The certificate type doesn't match. You need a **Code Signing** certificate, not an SSL/TLS certificate.

### SmartScreen still warns after signing
- OV certificates need time to build reputation
- EV certificates should work immediately — verify the certificate is actually EV
- Submit the signed installer to Microsoft for analysis (see link above)
- Check that timestamping succeeded (`rfc3161TimeStampServer` in config)

## CI/CD (GitHub Actions)

For automated Windows builds, store the `.pfx` as a base64-encoded GitHub Secret:

```bash
base64 -i code-signing-certificate.pfx | pbcopy
# Paste into GitHub Secret WIN_CSC_LINK
```

```yaml
- name: Build Windows app
  env:
    WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
    WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
  run: npm run build:win
```

**Note**: GitHub Actions Windows runners have `signtool.exe` pre-installed, so no additional setup is needed.
