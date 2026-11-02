# Fitness Coach mobile apps (Capacitor 8)

- **App id (bundle id / package name):** `com.nathrasher.fitnesscoach`. It's permanent once published.
- **Architecture:** a native shell whose web view loads the live site (`server.url` = https://fitness-coach-xamg.onrender.com).
  - The session cookie stays first-party: same origin as the website, so there are no CORS changes and no iOS ITP or third-party-cookie problems.
  - App updates ship with normal web deploys.
  - `www/offline.html` is bundled and shown when the server can't be reached (`server.errorPath`). It retries automatically while Render wakes up.
- **Native features** (`client/native.js`, inactive on the plain website):
  - status bar and safe areas
  - splash screen
  - local workout and streak reminders (Settings → Reminders)
  - Android back button
  - haptic tick on a barcode scan
  - refresh after 30+ minutes in the background
  - camera for the html5-qrcode scanner (Info.plist `NSCameraUsageDescription`, Android `CAMERA` permission)

## Build locally
```
cd mobile && npm ci
npx cap sync                       # copies config/plugins into ios/ and android/
cd android && ./gradlew assembleDebug   # needs JDK 21 + Android SDK 36
FC_SERVER_URL=http://10.0.2.2:8792 npx cap sync android   # emulator against a local server (test only)
npm run assets                     # regenerate icons/splash from assets/*.png
```
iOS uses Swift Package Manager (no CocoaPods). Open `ios/App/App.xcodeproj` in Xcode, or build in the cloud with `../codemagic.yaml`.

## iPhone → TestFlight, step by step
1. **Apple Developer Program.** Enroll at developer.apple.com/programs ($99/year) with your Apple ID. Pick Individual unless you have a company with a D-U-N-S number. Approval can take up to about 48 hours.
2. **App ID.** Go to Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App. Set Bundle ID (explicit) to `com.nathrasher.fitnesscoach` and the description to "Fitness Coach". No extra capabilities are needed, because local notifications need no Push capability.
3. **App record.** In App Store Connect (appstoreconnect.apple.com) → My Apps → **+** → New App.
   - Platform: iOS. Name: "Fitness Coach" (if it's taken, try "Fitness Coach – Nat" etc.).
   - Language: English (U.S.). Bundle ID: the one above. SKU: `fitness-coach-ios`.
   - Copy the app's **Apple ID** number (App Information) into `APP_ID` in `codemagic.yaml`.
4. **API key for Codemagic.** In App Store Connect go to Users and Access → Integrations → App Store Connect API → **+**.
   - Name it "Codemagic" with the **App Manager** role.
   - Download the `.p8` file (you can only download it once) and note the **Issuer ID** and **Key ID**.
5. **Codemagic.**
   - Sign up at codemagic.io with GitHub and add the `fitness-coach` repo.
   - Go to Team settings → Integrations → Developer Portal → Connect, and add the key with the name **FitnessCoachASC** (it must match `codemagic.yaml`).
   - Under Code signing identities → iOS certificates, **Generate certificate** (Apple Distribution).
   - Under iOS provisioning profiles, **Fetch** an App Store profile for the bundle id. Codemagic can create both automatically from the API key.
6. **Run** the "iOS → TestFlight" workflow on the `mobile-app` branch. After processing (about 10–30 minutes) the build appears under App Store Connect → TestFlight.
7. **Export compliance.** It's already answered in Info.plist (`ITSAppUsesNonExemptEncryption = NO`, since the app only uses standard HTTPS).
8. **Testers.**
   - TestFlight → Internal Testing → create a group and add yourself (and up to 100 App Store Connect users). Install the **TestFlight** app on your iPhone and accept the invite.
   - External testers (by email or a public link) need a short Beta App Review first.
9. **App Store submission (later).**
   - Fill in App Privacy (the "nutrition label"), matching privacy.html:
     - contact info (email)
     - health and fitness
     - photos
     - user content
     - identifiers (user id)
     - none used for tracking
   - Also needed: the privacy policy URL `https://fitness-coach-xamg.onrender.com/privacy.html`, a support URL, an age rating (13+ questionnaire), screenshots (6.9" iPhone: 1320×2868 or 1290×2796), a description, and keywords.
   - Give App Review a **demo account** (username + password) in "Sign-In Information".
   - Account deletion lives in Settings → Account → Delete account (guideline 5.1.1(v)).

## Android (Play Store, later)
- Get a Google Play Console account ($25 one-time).
- New personal accounts must run a closed test with 12+ testers for 14 days before production.
- Release builds need an upload keystore. Keep it out of git and add it to Codemagic as a secret.

## Health Connect (Android, v1)

- Plugin: `@capgo/capacitor-health` (Capacitor 8; covers Health Connect now and HealthKit later).
- Read-only: steps, active calories, distance, exercise sessions. The plugin declares many more permissions. `android/app/src/main/AndroidManifest.xml` strips them with `tools:node="remove"`. After any plugin upgrade, check the merged manifest with `aapt2 dump permissions app-debug.apk | grep health` and confirm only the 4 READ_* permissions remain.
- minSdk 26. The privacy policy URL shown by Health Connect is set in `strings.xml` (`health_connect_privacy_policy_url`, which points at `/privacy.html#health-connect`).
- Client: `client/health.js` uses one provider adapter per platform. Only `android` is implemented; add `ios` (HealthKit, source `healthkit`) there later. The server already accepts `source: "healthkit"`.
- Sync: on app open/resume (at most every 15 min) and via "Sync now". It sends the last 30 days to `POST /api/health/sync`, which upserts by user+date+source and dedupes workouts by user+source+externalId.
- Must be tested on a real Android device: the permission sheet, "not installed" and "update needed" states, and day bucketing in the phone's time zone.
- Play Console: complete the Health Connect permissions declaration (see the PR notes) before submitting.
