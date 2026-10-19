# Play Store and App Store app

A small native app that opens the live website (set by `APP_URL`) and adds phone notifications
through Firebase Cloud Messaging. Because it loads the website, changes to the site reach the
phones straight away; a new store release is needed only when this folder changes.

The go-live guide has the full steps, accounts and costs. In short:

## One-time setup

1. Firebase (free): create a project at https://console.firebase.google.com
   - Add an **Android app** with the same id as `APP_ID` → download `google-services.json`.
   - Add an **iOS app** with the same id → download `GoogleService-Info.plist`.
   - iOS only: in Apple Developer → Keys, create an **APNs key** and upload it in Firebase →
     Project settings → Cloud Messaging.
   - Project settings → Service accounts → **Generate new private key**. Base64 it and put it in the
     server's `.env` as `FCM_SERVICE_ACCOUNT_BASE64` (see the guide).
2. In this folder (PowerShell):

```powershell
$env:APP_URL="https://your-domain"; $env:APP_ID="com.example.flightops"; $env:APP_NAME="DHS Ops"
npm install
npx cap add android
npx cap add ios          # on a Mac only
npm run assets           # icons and splash screens from resources/
npx cap sync
```

3. Copy the Firebase files:
   - `google-services.json` → `android/app/`
   - `GoogleService-Info.plist` → `ios/App/App/` (add it to the App target in Xcode)

## Android extras (android/app/src/main/AndroidManifest.xml, inside <application>)

```xml
<meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notify" />
<meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/colorPrimary" />
```

Put `resources/notification-icon.png` into `android/app/src/main/res/drawable/ic_stat_notify.png`.
For "Take a photo" on the profile page also add, outside <application>:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

Build: `npm run android` opens Android Studio → Build → Generate Signed App Bundle (.aab) → upload to
Google Play Console. Keep the signing key file safe; you need it for every update.

## iPhone extras (Xcode, on a Mac or a cloud Mac such as Codemagic)

- Signing & Capabilities → add **Push Notifications** and **Background Modes → Remote notifications**.
- `ios/App/App/AppDelegate.swift`: add the three notification methods from the plugin's iOS setup
  (https://capawesome.io/plugins/firebase/cloud-messaging/#ios).
- `Info.plist`: add `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`
  ("Used to add your personnel photo.").
- Product → Archive → Distribute → App Store Connect → TestFlight for trial users, then submit.

## Notes

- Report downloads (PDF/Excel) open best from a browser; inside the app, use the website for exports.
- The app id (`APP_ID`) cannot change after the first store release.
