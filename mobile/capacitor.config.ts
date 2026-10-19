import type { CapacitorConfig } from '@capacitor/cli';

// The app opens the live website, so every update to the site reaches the phones without a new
// store release. Set these before `npx cap sync` (see mobile/README.md):
//   APP_URL   the website address, e.g. https://ops.example.com
//   APP_ID    a reverse-domain id that never changes once published, e.g. com.example.flightops
//   APP_NAME  the name under the icon, e.g. DHS Ops
const url = (process.env.APP_URL ?? 'https://ops.example.com').replace(/\/$/, '');

const config: CapacitorConfig = {
  appId: process.env.APP_ID ?? 'com.example.flightops',
  appName: process.env.APP_NAME ?? 'DHS Ops',
  webDir: 'www',
  server: {
    url,
    cleartext: false,
    allowNavigation: [new URL(url).host],
    errorPath: 'index.html',
  },
  backgroundColor: '#0B1F3A',
  plugins: {
    FirebaseMessaging: { presentationOptions: ['alert', 'badge', 'sound'] },
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#0B1F3A', showSpinner: false },
  },
  android: { allowMixedContent: false },
  ios: { contentInset: 'automatic' },
};

export default config;
