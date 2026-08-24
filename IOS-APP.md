# iPhone App — status and launch guide

Find My Quiet Sound ships as a native iOS app using a Capacitor 8 shell around the
production web app. Everything that can be prepared **without an Apple developer
account** is done and committed. This file is the map of what exists and the exact
steps left for you.

## What is already prepared (no account needed)

- `native/` — the Capacitor project.
  - `build-www.js` copies the production app (plus Learn/About/Privacy pages) into
    `native/www`; the bundle ships **inside** the app, so it works fully offline and
    is not a "thin website wrapper" (App Review guideline 4.2 mitigation).
  - `capacitor.config.json` — app id `com.findmyquietsound.app`, name
    "Find My Quiet Sound", dark launch background.
  - `native/ios/` — the Xcode project, already configured:
    - **Background audio** (`UIBackgroundModes: audio`) so sound keeps playing with
      the screen locked — with lock-screen controls via the app's Media Session code.
    - **AVAudioSession `.playback`** in `AppDelegate.swift` so audio plays even with
      the silent switch on (essential for a sleep app).
    - `ITSAppUsesNonExemptEncryption = NO` (HTTPS only) — no export-compliance
      questions at submission.
    - App icon (1024×1024, opaque, App Store compliant) and brand launch screen.
- `.github/workflows/ios-build.yml` — cloud build on GitHub's macOS runners, so you
  never need a Mac:
  - **Unsigned lane** (works today): GitHub → Actions → *iOS build* → Run workflow.
    Compiles the whole app and uploads `FindMyQuietSound-unsigned.ipa`.
  - **Signed lane** (after enrollment): same workflow with *signed* checked +
    four repository secrets; produces a TestFlight-ready `.ipa`.
- The web app needs **no changes**: service-worker registration is already skipped
  on the native scheme, and the PWA "Install app" button never appears in the shell.

## Step 0 — Activate the cloud build workflow (one-time, 2 minutes)

The workflow file exists locally at `.github/workflows/ios-build.yml` but GitHub
refused the push: the stored GitHub token lacks the `workflow` scope. Two ways to
fix (either works):

- **Option A (recommended):** open a terminal and run
  `gh auth refresh -h github.com -s workflow` — approve in the browser when
  prompted, then tell Claude "push the iOS workflow" (or push yourself:
  `git add .github && git commit -m "Add iOS build workflow" && git push`).
- **Option B:** on github.com → the softwave repo → *Add file* → *Create new file* →
  name it `.github/workflows/ios-build.yml` → paste the contents of the local file.

## Step 1 — Enroll in the Apple Developer Program (you)

1. Create/sign in with an Apple ID at https://developer.apple.com
2. Enroll in the Apple Developer Program — **$99/year** (Individual is fine;
   the seller name shown in the App Store will be your personal name unless you
   enroll as an organization, which needs a D-U-N-S number).
3. Enrollment approval usually takes 24–48 h.

## Step 2 — Register the app id and create signing assets

All of this happens on developer.apple.com and appstoreconnect.apple.com — no Mac
needed (certificate signing requests can be generated with OpenSSL on Windows):

1. **Identifiers** → register bundle id `com.findmyquietsound.app`
   (must match `native/capacitor.config.json`).
2. **Certificates** → create an *Apple Distribution* certificate.
   Generate the CSR on this PC:
   ```bash
   openssl genrsa -out ios_dist.key 2048
   openssl req -new -key ios_dist.key -out ios_dist.csr -subj "/emailAddress=alondamari@hotmail.com/CN=Find My Quiet Sound/C=US"
   ```
   Upload `ios_dist.csr`, download `distribution.cer`, then build the .p12:
   ```bash
   openssl x509 -in distribution.cer -inform DER -out ios_dist.pem
   openssl pkcs12 -export -inkey ios_dist.key -in ios_dist.pem -out ios_dist.p12
   ```
   (choose an export password — you'll store it as a secret).
3. **Profiles** → create an *App Store* provisioning profile for
   `com.findmyquietsound.app`, download `app.mobileprovision`.
4. **App Store Connect** → *My Apps* → **+ New App** → iOS, name
   "Find My Quiet Sound", the bundle id, SKU e.g. `fmqs-ios`.

## Step 3 — Add the four GitHub secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `IOS_CERT_P12_BASE64` | `base64 -w0 ios_dist.p12` output |
| `IOS_CERT_PASSWORD` | the .p12 export password |
| `IOS_PROFILE_BASE64` | `base64 -w0 app.mobileprovision` output |
| `APPLE_TEAM_ID` | 10-character Team ID (developer.apple.com → Membership) |

## Step 4 — Build signed and upload to TestFlight

1. GitHub → Actions → *iOS build* → Run workflow → check **signed** → run.
2. Download `FindMyQuietSound.ipa` from the run's artifacts.
3. Upload to App Store Connect — easiest from any browser is the
   **Transporter**-compatible API: or install "Transporter" on any borrowed Mac,
   or use `xcrun altool`/`fastlane pilot` in a follow-up CI step (ask Claude to
   wire automatic TestFlight upload once the account exists — it needs an
   App Store Connect API key, 5 minutes).
4. TestFlight → add yourself as internal tester → install on your iPhone → verify:
   audio starts, keeps playing with the screen locked, silent switch on, lock-screen
   Play/Pause works, sleep timer fires, saved sounds persist after relaunch.

## Step 5 — App Store listing (submission checklist)

- **Category:** Health & Fitness. **Price:** Free. No in-app purchases (matches
  `MONETIZATION_ENABLED=false` — do not mention future pricing in the listing).
- **Privacy nutrition label:** "Data not collected" — the app has no accounts,
  no analytics beacons, no tracking; everything stays on device. (If Supabase
  accounts are activated later, this label must be updated before that build ships.)
- **Description:** reuse the site's conservative language — sound masking and
  relaxation for tinnitus comfort; explicitly *not* a medical treatment. Never use
  cure/treat/diagnose. Include the medical disclaimer link
  (https://findmyquietsound.com/medical-disclaimer/) in the description or support URL.
- **Support URL:** https://findmyquietsound.com/contact/ ·
  **Privacy Policy URL:** https://findmyquietsound.com/privacy/
- **Review notes (guideline 4.2 defense):** "All 20 sounds are synthesised on-device
  in real time (Web Audio) — no streaming, works fully offline; includes background
  audio with lock-screen controls, sleep timer with fade-out, five-layer mixer,
  frequency generator, and generative visuals. The app bundle is self-contained,
  not a repackaged website."
- Screenshots: 6.9" and 6.5" iPhone sizes required — take them in TestFlight on
  your phone, or ask Claude to produce simulator screenshots via CI.

## Known notes

- The native app is a separate origin: sounds/mixes saved on the website don't
  carry into the app (and vice versa). Fine at launch; the dormant cloud-accounts
  layer is the future bridge.
- After any web-app change, the app inherits it at the **next CI build** (the
  bundle is copied at build time). Ship an app update for meaningful changes.
- Android later: `npx cap add android` in `native/` reuses everything here;
  Google Play enrollment is a one-time $25.
